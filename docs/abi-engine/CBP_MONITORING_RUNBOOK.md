# CBP connection monitoring

## What to monitor

Point the external uptime monitor at both URLs, every 5 minutes or less. Alert after 2 failed checks.

| URL | Fails when |
|---|---|
| `https://app.mycargolens.com/api/health` | Server or database is down |
| `https://app.mycargolens.com/api/v1/status/cbp` | CBP responses have not been pulled for 5 minutes (503) |

`/api/v1/status/cbp` is the one that catches a CBP outage. `/api/health` stays 200 through one.

## States

| `state` | HTTP | Meaning |
|---|---|---|
| `ok` | 200 | Inbound pull succeeded in the last 5 minutes |
| `starting` | 200 | Server booted less than 5 minutes ago |
| `stalled` | 503 | No success for 5 minutes, or none since boot |
| `disabled` | 200 | This server has no live CBP transport |

`ok` means the queues can be read. It does not prove CBP is accepting filings.

## When it alerts

1. Open `https://app.mycargolens.com/api/health`. `jobs` shows the last error for `cbp-inbound`.
2. `ssh mycargolens-prod "docker logs --tail 40 mycargolens-mq-bridge"`.
3. Bridge errors: see `MQIPT_RUNBOOK.md`.
4. If the channel is refused on CBP's side, email MQSTAFFOPS@cbp.dhs.gov.

While stalled, sends may fail and CBP responses wait on the queue. They are picked up when the connection returns.
