/**
 * CBP MQIPT bridge — the one process that speaks IBM MQ.
 *
 * The main app image is Alpine (musl); IBM's MQ client is glibc-only, so the
 * MQ binding lives in this Debian sidecar instead. The server's MqiptTransport
 * calls this bridge over the internal Docker network; nothing here is ever
 * exposed to the internet (no published ports, shared-token auth as depth).
 *
 * MQ specifics (CBP SIGMATP trade package, Aug 2026):
 *   - Connection is CCDT-driven: MQCHLLIB/MQCHLTAB point at QGC1_SIGMATP.TAB,
 *     which carries channel, host:port, and cipher. MQCLNTCF points at CBP's
 *     mqclient.ini (OCSP bypass). All three are plain MQ-client env vars.
 *   - TLS keystore is CMS (sigmatp.kdb + .sth stash); MQ_KEY_REPOSITORY is
 *     the path WITHOUT the .kdb extension, per GSKit convention.
 *   - One MQ message = one complete ABI batch (A…Z records). Outbound we
 *     join 80-char records with MQ_RECORD_DELIMITER (lf|crlf|none); inbound
 *     we split on newlines. Delimiter is env-tunable so a CERT-floor surprise
 *     is a config change, not a redeploy.
 */
'use strict';

const http = require('http');
const mq = require('ibmmq');

const MQC = mq.MQC;

// ── config ──────────────────────────────────────────────────────────────
const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

const CONFIG = {
  port: Number(env('PORT', '8080')),
  token: env('MQ_BRIDGE_TOKEN', ''),
  qmgr: env('MQ_QMGR', ''),
  sendQueue: env('MQ_SEND_QUEUE', ''),
  receiveQueue: env('MQ_RECEIVE_QUEUE', ''),
  verifyPutQueue: env('MQ_VERIFY_PUT_QUEUE', 'TRADE.VERIFY.QR'),
  verifyGetQueue: env('MQ_VERIFY_GET_QUEUE', 'TRADE.VERIFY.QL'),
  keyRepository: env('MQ_KEY_REPOSITORY', ''),
  recordDelimiter: env('MQ_RECORD_DELIMITER', 'lf'),
};

const REQUIRED = ['qmgr', 'sendQueue', 'receiveQueue', 'keyRepository'];
const missing = REQUIRED.filter((k) => !CONFIG[k]);
if (missing.length > 0) {
  console.error(`mq-bridge: missing required config: ${missing.map((k) => 'MQ_' + k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()).join(', ')}`);
  process.exit(1);
}

const DELIMITERS = { lf: '\n', crlf: '\r\n', none: '' };
if (!(CONFIG.recordDelimiter in DELIMITERS)) {
  console.error(`mq-bridge: MQ_RECORD_DELIMITER must be lf|crlf|none, got '${CONFIG.recordDelimiter}'`);
  process.exit(1);
}
const DELIMITER = DELIMITERS[CONFIG.recordDelimiter];

// 4 MB receive buffer — ABI response batches are tens of KB at most.
const GET_BUFFER_BYTES = 4 * 1024 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── MQ session (lazy connect, reconnect on next call after any error) ───
class MqSession {
  constructor() {
    this.conn = null;
    this.queues = new Map(); // name → { hObj, forInput }
  }

  async connect() {
    if (this.conn) return this.conn;
    const cno = new mq.MQCNO();
    cno.Options = MQC.MQCNO_CLIENT_BINDING;
    const sco = new mq.MQSCO();
    sco.KeyRepository = CONFIG.keyRepository;
    cno.SSLConfig = sco;
    this.conn = await mq.ConnxPromise(CONFIG.qmgr, cno);
    return this.conn;
  }

  async open(queueName, forInput) {
    const key = `${queueName}:${forInput ? 'in' : 'out'}`;
    const cached = this.queues.get(key);
    if (cached) return cached;
    const conn = await this.connect();
    const od = new mq.MQOD();
    od.ObjectName = queueName;
    od.ObjectType = MQC.MQOT_Q;
    const openOptions = forInput
      ? MQC.MQOO_INPUT_AS_Q_DEF | MQC.MQOO_FAIL_IF_QUIESCING
      : MQC.MQOO_OUTPUT | MQC.MQOO_FAIL_IF_QUIESCING;
    const hObj = await mq.OpenPromise(conn, od, openOptions);
    this.queues.set(key, hObj);
    return hObj;
  }

  /** Drop all handles so the next call reconnects from scratch. */
  async reset() {
    const conn = this.conn;
    this.conn = null;
    this.queues.clear();
    if (conn) {
      try {
        await mq.DiscPromise(conn);
      } catch {
        /* already broken — that's why we're resetting */
      }
    }
  }

  async put(queueName, text, correlationId) {
    const hObj = await this.open(queueName, false);
    const mqmd = new mq.MQMD();
    mqmd.Format = MQC.MQFMT_STRING;
    if (correlationId) {
      const corr = Buffer.alloc(24);
      corr.write(String(correlationId).slice(0, 24), 'utf8');
      mqmd.CorrelId = corr;
    }
    const pmo = new mq.MQPMO();
    pmo.Options = MQC.MQPMO_NO_SYNCPOINT | MQC.MQPMO_NEW_MSG_ID | MQC.MQPMO_FAIL_IF_QUIESCING;
    await mq.PutPromise(hObj, mqmd, pmo, Buffer.from(text, 'utf8'));
    return mqmd.MsgId.toString('hex');
  }

  /** One non-blocking get; resolves null when the queue is empty. */
  getOne(queueName) {
    return this.open(queueName, true).then(
      (hObj) =>
        new Promise((resolve, reject) => {
          const md = new mq.MQMD();
          const gmo = new mq.MQGMO();
          gmo.Options =
            MQC.MQGMO_NO_SYNCPOINT |
            MQC.MQGMO_NO_WAIT |
            MQC.MQGMO_CONVERT |
            MQC.MQGMO_FAIL_IF_QUIESCING;
          gmo.MatchOptions = MQC.MQMO_NONE;
          const buf = Buffer.alloc(GET_BUFFER_BYTES);
          mq.GetSync(hObj, md, gmo, buf, (err, len) => {
            if (err) {
              if (err.mqrc === MQC.MQRC_NO_MSG_AVAILABLE) return resolve(null);
              return reject(err);
            }
            resolve(buf.subarray(0, len).toString('utf8'));
          });
        })
    );
  }

  /** Poll a queue until a message arrives or timeoutMs elapses. */
  async getWithTimeout(queueName, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const msg = await this.getOne(queueName);
      if (msg !== null) return msg;
      if (Date.now() >= deadline) return null;
      await sleep(500);
    }
  }
}

const session = new MqSession();

/** Run an MQ operation; on failure reset the session so the next call reconnects. */
async function withSession(fn) {
  try {
    return await fn(session);
  } catch (err) {
    await session.reset();
    throw err;
  }
}

const describeMqError = (err) =>
  err && err.mqrc !== undefined ? `MQRC ${err.mqrc} (${err.message})` : String((err && err.message) || err);

// ── batch ↔ message codec ────────────────────────────────────────────────
const linesToMessage = (lines) => lines.join(DELIMITER);
// Keep records byte-for-byte (trailing pad spaces are significant in
// fixed-width CATAIR); only drop lines that are entirely blank.
const messageToLines = (text) => text.split(/\r?\n/).filter((l) => l.trim() !== '');

// ── HTTP layer ───────────────────────────────────────────────────────────
const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const handlers = {
  'GET /health': async () => {
    try {
      await withSession(async (s) => {
        await s.open(CONFIG.sendQueue, false);
        await s.open(CONFIG.receiveQueue, true);
      });
      return { status: 200, body: { ok: true, detail: `connected to ${CONFIG.qmgr}` } };
    } catch (err) {
      return { status: 200, body: { ok: false, detail: describeMqError(err) } };
    }
  },

  'POST /send': async (body) => {
    if (!Array.isArray(body.lines) || body.lines.length === 0 || !body.lines.every((l) => typeof l === 'string')) {
      return { status: 400, body: { error: 'lines must be a non-empty string array' } };
    }
    const messageId = await withSession((s) =>
      s.put(CONFIG.sendQueue, linesToMessage(body.lines), body.correlationId)
    );
    return { status: 200, body: { messageId } };
  },

  'POST /receive': async (body) => {
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 15000, 0), 60000);
    const max = Math.min(Math.max(Number(body.max) || 10, 1), 100);
    const batches = await withSession(async (s) => {
      const out = [];
      // Wait (up to timeoutMs) for the first message, then drain without waiting.
      const first = await s.getWithTimeout(CONFIG.receiveQueue, timeoutMs);
      if (first !== null) {
        out.push(messageToLines(first));
        while (out.length < max) {
          const next = await s.getOne(CONFIG.receiveQueue);
          if (next === null) break;
          out.push(messageToLines(next));
        }
      }
      return out;
    });
    return { status: 200, body: { batches } };
  },

  // CBP's own connectivity check: put to TRADE.VERIFY.QR, the queue manager
  // echoes onto TRADE.VERIFY.QL. Proves TLS, channel, and queue access.
  'POST /verify': async () => {
    try {
      const result = await withSession(async (s) => {
        const probe = `MYCARGOLENS CONNECTIVITY CHECK ${new Date().toISOString()}`;
        await s.put(CONFIG.verifyPutQueue, probe);
        const echoed = await s.getWithTimeout(CONFIG.verifyGetQueue, 20000);
        return { probe, echoed };
      });
      if (result.echoed === null) {
        return { status: 200, body: { ok: false, detail: 'put succeeded but nothing echoed on the verify queue within 20s' } };
      }
      return { status: 200, body: { ok: true, detail: 'round-trip verified', echoed: result.echoed } };
    } catch (err) {
      return { status: 200, body: { ok: false, detail: describeMqError(err) } };
    }
  },
};

const server = http.createServer(async (req, res) => {
  if (CONFIG.token && req.headers['x-bridge-token'] !== CONFIG.token) {
    return json(res, 401, { error: 'unauthorized' });
  }
  const route = `${req.method} ${req.url.split('?')[0]}`;
  const handler = handlers[route];
  if (!handler) return json(res, 404, { error: `no route ${route}` });
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const result = await handler(body);
    json(res, result.status, result.body);
  } catch (err) {
    console.error(`mq-bridge: ${route} failed:`, err);
    json(res, 502, { error: describeMqError(err) });
  }
});

server.listen(CONFIG.port, () => {
  console.log(
    `mq-bridge listening on :${CONFIG.port} — qmgr=${CONFIG.qmgr} send=${CONFIG.sendQueue} receive=${CONFIG.receiveQueue} delimiter=${CONFIG.recordDelimiter}`
  );
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => {
      session.reset().finally(() => process.exit(0));
    });
  });
}
