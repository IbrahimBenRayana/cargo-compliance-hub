# MQIPT Runbook — native ABI connection to CBP

How MyCargoLens connects to CBP's ACE system over IBM MQ via MQIPT
(MQ Internet Pass-Thru), and how to operate/renew that connection.

## Architecture

```
server (Alpine, no MQ libs)                 CBP
  MqiptTransport ──HTTP──▶ mq-bridge ──MQ/TLS──▶ cbpgw-trade-{cert,prod} ──▶ QGC1/QGP2
  (thin client)           (Debian sidecar,        (MQIPT gateway,             (queue
                           ibmmq binding)          port 31531/31530)           managers)
```

- The IBM MQ client is **glibc-only** → it lives in the `mq-bridge` sidecar
  (`server/mq-bridge/`), not the Alpine app image.
- The sidecar starts only where `.env` has `COMPOSE_PROFILES=mqipt`
  (staging today; prod after certification). No published ports — the server
  reaches it at `http://mq-bridge:8080` on the compose network, authenticated
  with `MQIPT_BRIDGE_TOKEN`.
- The server flips from the mock loopback with `ABI_TRANSPORT=mqipt`.

## Connection parameters (CBP MQDEF, Aug 2026)

| | CERT | PROD |
|---|---|---|
| Queue manager | `QGC1` | `QGP2` |
| Gateway | `cbpgw-trade-cert.cbp.dhs.gov:31531` | `cbpgw-trade-prod.cbp.dhs.gov:31530` |
| Channel (via CCDT) | `QGC1_SIGMATP` | `QGP2_SIGMATP` |
| Put filings to | `ACS.BRK.INBOUND` | same |
| Read responses from | `ACS.BRK.1303S7P.OUTBOUND` | same |
| Verify round-trip | put `TRADE.VERIFY.QR` → echo on `TRADE.VERIFY.QL` | same |
| Cipher | `ECDHE_RSA_AES_256_GCM_SHA384` (from CCDT) | same |

Firewall: outbound TCP to the gateway IPs published in the CBP instructions
(CERT: 3.212.213.206, 44.193.89.61, 44.240.121.200, 34.215.90.39).

## Credentials — the SIGMATP trade package

**DHS-restricted. Never in git** (gitignored, including `*.kdb`, `*.sth`,
`*.TAB`). Lives on the VM at `/opt/mycargolens/mqipt/`, owner uid 1000,
mounted read-only into the sidecar at `/opt/mqipt`:

| File | Purpose |
|---|---|
| `QGC1_SIGMATP.TAB` / `QGP2_SIGMATP.TAB` | CCDT channel tables (channel, host:port, cipher) |
| `sigmatp.kdb` + `sigmatp.sth` | CMS keystore + password stash (client TLS cert) |
| `mqclient.ini` | CBP-supplied client config (OCSP bypass — must be used as-is) |

To (re)install: `scp` the files from the CBP package to
`/opt/mycargolens/mqipt/` and rename `mqclient.init_rename.txt` → `mqclient.ini`.

## Environment variables

VM `.env` (staging values):

```
COMPOSE_PROFILES=mqipt          # starts the sidecar
ABI_TRANSPORT=mqipt             # server uses the bridge instead of the mock
MQIPT_BRIDGE_TOKEN=<random>     # shared secret server↔bridge
# defaults already in compose: MQ_QMGR=QGC1, MQCHLTAB=QGC1_SIGMATP.TAB,
# MQ_SEND_QUEUE=ACS.BRK.INBOUND, MQ_RECEIVE_QUEUE=ACS.BRK.1303S7P.OUTBOUND
```

PROD cutover (later, after certification): set `MQ_QMGR=QGP2` and
`MQCHLTAB=QGP2_SIGMATP.TAB` — same keystore, same queues.

`MQ_RECORD_DELIMITER` (lf|crlf|none, default lf) controls how 80-char
records are joined into one MQ message; env-tunable in case the CERT floor
expects a different framing.

## Verification

1. **TCP reachability** (from the VM):
   `timeout 5 bash -c 'exec 3<>/dev/tcp/cbpgw-trade-cert.cbp.dhs.gov/31531' && echo OPEN`
2. **Bridge health** (connect + open both queues):
   `GET /api/cert-console/transport` (platform admin) — or from the VM:
   `docker exec mycargolens-server wget -qO- http://mq-bridge:8080/health --header "x-bridge-token: $TOKEN"`
3. **CBP round-trip** (the check CBP designed):
   `POST /api/cert-console/transport/verify` — puts a probe on
   `TRADE.VERIFY.QR` and waits for the echo on `TRADE.VERIFY.QL`.
   Success proves TLS, channel, and queue access end to end.

## Certificate renewal — ⚠ yearly

- The keystore certificate is **valid 1 year** (issued Aug 2026 → expires ~Aug 2027).
- CBP emails an updated keystore from `MQ_INFRASTRUCTURE@CBP.DHS.GOV`
  **~97 days before expiry** (~May 2027). Watch for it; it can look like spam.
- Install = replace `sigmatp.kdb`/`sigmatp.sth` on the VM (back up the old
  ones first), restart the sidecar, run the verify round-trip, then **reply to
  the CBP technician confirming success** (they ask for this).
- Help: `MQSTAFFOPS@cbp.dhs.gov` (all MQ correspondence goes here).

## CBP contacts

- MQ middleware (business hours): `MQSTAFFOPS@cbp.dhs.gov`, 703-921-6635
- After-hours production support: Technology Operations Center 703-921-6068
- Client reps: Dionne Durham / Christine Cahill (Trade Transformation Office)

## Troubleshooting

- `MQRC 2538` host not available → firewall/DNS from the VM; rerun the TCP check.
- `MQRC 2393` SSL initialization error → keystore path (`MQ_KEY_REPOSITORY`
  is the path **without** `.kdb`), stash file missing, or expired cert.
- `MQRC 2035` not authorized → channel/queue mismatch — confirm the CCDT file
  matches the environment (QGC1 vs QGP2).
- `MQRC 2085` unknown object → queue name typo; check `MQ_SEND_QUEUE`/`MQ_RECEIVE_QUEUE`.
- Bridge logs: `docker logs mycargolens-mq-bridge`. MQ client error logs land
  in the container under `~/IBM/MQ/data/errors/` when things fail before MQRC.
