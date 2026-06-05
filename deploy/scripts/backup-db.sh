#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Nightly Postgres backup for MyCargoLens.
# ─────────────────────────────────────────────────────────────
# Dumps the mycargolens database into /opt/mycargolens/backups/
# as a gzipped pg_dump with a UTC timestamp suffix, then prunes
# anything older than RETENTION_DAYS (default 14).
#
# Runs via the cron entry installed by install-backup.sh — see
# that file for the install steps. Designed to be re-runnable
# any time (manual `bash backup-db.sh` works the same as cron).
#
# IMPORTANT: this is a LOCAL backup on the same VPS. If the
# whole VPS dies, these backups die with it. Off-VPS shipping
# (S3 / B2 / Azure Blob) is a separate follow-up — leave a
# TODO comment in the cron when you wire that up.

set -euo pipefail

CONTAINER="${BACKUP_DB_CONTAINER:-mycargolens-db}"
DB_NAME="${BACKUP_DB_NAME:-mycargolens}"
DB_USER="${BACKUP_DB_USER:-mycargolens}"
BACKUP_DIR="${BACKUP_DIR:-/opt/mycargolens/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TS="$(date -u +%Y%m%d_%H%M%SZ)"
OUT="$BACKUP_DIR/mycargolens_${TS}.sql.gz"

echo "[backup] dumping $DB_NAME → $OUT"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip -9 > "$OUT.tmp"

# Atomic rename so a half-written file never looks like a complete backup.
mv "$OUT.tmp" "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup] wrote $SIZE → $OUT"

# Prune old backups. -mtime +N matches files modified MORE than N days ago,
# so RETENTION_DAYS=14 keeps the last 14-15 days of nightly snapshots.
PRUNED=$(find "$BACKUP_DIR" -name 'mycargolens_*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
echo "[backup] pruned $PRUNED file(s) older than $RETENTION_DAYS days"

# Quick sanity: don't let the backup dir silently balloon past 10 GiB.
USED_KB="$(du -sk "$BACKUP_DIR" | cut -f1)"
if [ "$USED_KB" -gt 10485760 ]; then
  echo "[backup] WARN: $BACKUP_DIR is now $((USED_KB/1024))MB — investigate retention"
fi

echo "[backup] done"
