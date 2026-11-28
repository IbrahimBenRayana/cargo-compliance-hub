#!/usr/bin/env zsh
# bin/reset.sh — drop anything a capture run created (drafts made from a template), promo DB only.
set -e
ROOT="${0:A:h:h}"; REPO="${ROOT:h:h:h:h}"
URL=$(grep -E '^DATABASE_URL' "$REPO/server/.env" | cut -d= -f2- | tr -d '"'); URL="${URL%%\?*}"
[[ "$URL" == */mycargolens_promo ]] || { echo "refusing: not the promo database"; exit 1; }
psql "$URL" -v ON_ERROR_STOP=1 -qAtc "DELETE FROM filings WHERE created_at > (SELECT created_at FROM filings WHERE master_bol = 'HLCU349102260' AND status = 'draft')"
