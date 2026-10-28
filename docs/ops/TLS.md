# TLS certificates — state, monitoring, runbook

Two VPSes, three public hostnames, all Let's Encrypt via certbot.

| Host | VPS | certbot authenticator | Notes |
|---|---|---|---|
| `mycargolens.com`, `www.` | old — `5.180.151.204` | nginx | production landing |
| `staging.mycargolens.com` | old — `5.180.151.204` | nginx | staging app |
| `app.mycargolens.com` | new — `62.146.225.94` | nginx | production app |

Renewal is automatic (`certbot.timer`, enabled + active, fires twice daily).
The nginx installer reloads nginx itself after a renewal, so no deploy hook is
required.

## Verified state (2026-08-18)

- `certbot renew --dry-run` on the old VPS: **exit 0**, "all simulated renewals
  succeeded" — the ACME account is healthy. This closes the canary set after the
  2026-08-04 outage: the failure mode from that incident (certbot with no usable
  ACME account) is **not** present.
- `certbot.service`: `Result=success`, `ExecMainStatus=0`.
- Expiry: mycargolens.com 2026-09-20, staging 2026-09-22, app 2026-11-02.

### Fixed the same day: a permanently-red certbot

The old VPS still carried an nginx server block and an **expired** certificate
for `app.mycargolens.com`, left behind when the production app moved to the new
VPS. Because that lineage used the `standalone` authenticator (which cannot bind
:80 while nginx holds it), every daily renewal failed, so `certbot.service` had
been exiting 1 continuously.

That is the dangerous part: **a service that is always red cannot tell you when
something real breaks.** A genuine renewal failure on `mycargolens.com` would
have looked exactly like the existing noise — the same blindness that produced
the August outage, wearing a different hat.

Removed: the dead nginx block (config backed up to
`/etc/nginx/sites-available/mycargolens.com.bak-2026-08-18`), `app.` dropped
from the port-80 redirect's `server_name`, and the stale lineage deleted with
`certbot delete --cert-name app.mycargolens.com`. `nginx -t` passed before the
reload; both live sites verified 200/301 immediately after.

## Monitoring

`.github/workflows/tls-expiry.yml` checks every public host **from outside** the
VPSes daily at 07:15 UTC: warns at 21 days, fails at 7, fails on expiry or on an
unreadable certificate. A failed run notifies the repo owner.

This exists because the deploy health gate only probes `localhost` over HTTP and
is structurally incapable of seeing a public TLS problem.

> **Caveat — not yet active.** GitHub only runs `schedule` and
> `workflow_dispatch` workflows from the **default branch**. The file is on
> `staging`; it starts running once `staging` merges to `main`. Its logic was
> verified against all four live hostnames in a Linux container (matching the
> runner's GNU `date -d` semantics) and returned the correct days-remaining and
> exit code for each.

## Runbook

**Check expiry from anywhere**

```bash
for h in mycargolens.com staging.mycargolens.com app.mycargolens.com; do
  echo | openssl s_client -servername $h -connect $h:443 2>/dev/null \
    | openssl x509 -noout -subject -enddate
done
```

**Verify renewal actually works** (the test that matters — exercises the ACME
account exactly as a real renewal will, without consuming rate limit):

```bash
ssh mycargolens        # or mycargolens-prod
sudo certbot renew --dry-run     # expect exit 0
sudo certbot certificates        # per-lineage expiry
systemctl show certbot.service -p Result -p ExecMainStatus
```

`certbot renew --dry-run` takes several minutes — run it in the background or
allow a generous timeout.

**Force a renewal** (only when a cert is genuinely near expiry; Let's Encrypt
rate-limits 5 duplicate certs per week):

```bash
sudo certbot renew --force-renewal --cert-name mycargolens.com
sudo nginx -t && sudo systemctl reload nginx
```

**If renewal fails**

1. `sudo tail -100 /var/log/letsencrypt/letsencrypt.log` — read the actual error.
2. Confirm :80 reaches the box (the HTTP-01 challenge needs it) and that the
   `.well-known/acme-challenge/` location still exists in the nginx config.
3. Confirm DNS still points at this VPS — a hostname that moved leaves behind a
   lineage that can never renew. Delete it (`certbot delete --cert-name …`)
   rather than letting it fail forever; see above for why.
4. Check for an ACME account: `sudo ls /etc/letsencrypt/accounts/*/*/`. An empty
   result is the 2026-08-04 failure mode — re-register with
   `sudo certbot register --agree-tos -m <ops-email>`.

## Standing rules

- Never let a lineage fail indefinitely. Either fix it or delete it — permanent
  red is indistinguishable from a new failure.
- Delete the nginx block **before** the certificate. nginx will not start with
  `ssl_certificate` pointing at a missing file, so the reverse order turns the
  next reload into an outage.
- Always `nginx -t` before `systemctl reload nginx`, and reload rather than
  restart: a reload with a bad config leaves the running process untouched.
