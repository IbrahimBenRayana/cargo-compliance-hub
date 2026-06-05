#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Install the nightly pg_dump cron on the VPS.
# ─────────────────────────────────────────────────────────────
# Idempotent — re-running is safe. Run this once after merging
# the hardening PR; the cron then fires every night at 03:00 UTC.
#
# Usage on the VPS:
#   bash deploy/scripts/install-backup.sh
#
# What it does:
#   1. Drops the backup-db.sh script under /opt/mycargolens/scripts/
#   2. Adds a root cron entry that runs it nightly at 03:00 UTC
#      and logs to /var/log/mycargolens-backup.log
#   3. Creates the backup directory + log file with sensible perms
#
# Off-VPS sync (S3 / Azure Blob / Backblaze B2) is intentionally NOT
# wired here — pick a destination + credentials first, then extend
# backup-db.sh with the rclone/aws-cli push at the bottom.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[install-backup] must run as root (try: sudo bash $0)" >&2
  exit 1
fi

INSTALL_DIR="/opt/mycargolens/scripts"
BACKUP_DIR="/opt/mycargolens/backups"
LOG_FILE="/var/log/mycargolens-backup.log"
SCRIPT_SRC="$(cd "$(dirname "$0")" && pwd)/backup-db.sh"
SCRIPT_DST="$INSTALL_DIR/backup-db.sh"

# Cron line — once per day at 03:00 UTC. Output captured to the log.
CRON_LINE="0 3 * * * $SCRIPT_DST >> $LOG_FILE 2>&1"
CRON_MARKER="# mycargolens-nightly-backup"

mkdir -p "$INSTALL_DIR" "$BACKUP_DIR"
# If the operator scp'd the installer + backup script into INSTALL_DIR
# already (the common path: `scp deploy/scripts/*.sh vps:$INSTALL_DIR/`
# then `sudo bash $INSTALL_DIR/install-backup.sh`), SCRIPT_SRC and
# SCRIPT_DST point to the same inode and `install` errors out. Skip
# the copy in that case but still pin permissions on the destination.
if [ "$(readlink -f "$SCRIPT_SRC")" = "$(readlink -f "$SCRIPT_DST")" ]; then
  chown root:root "$SCRIPT_DST"
  chmod 0750 "$SCRIPT_DST"
else
  install -m 0750 -o root -g root "$SCRIPT_SRC" "$SCRIPT_DST"
fi
touch "$LOG_FILE"
chmod 0640 "$LOG_FILE"

# Replace any prior copy of our cron line, leaving everything else intact.
TMP_CRON="$(mktemp)"
crontab -u root -l 2>/dev/null | grep -vF "$CRON_MARKER" > "$TMP_CRON" || true
{
  echo "$CRON_MARKER"
  echo "$CRON_LINE"
} >> "$TMP_CRON"
crontab -u root "$TMP_CRON"
rm -f "$TMP_CRON"

echo "[install-backup] script installed at $SCRIPT_DST"
echo "[install-backup] cron entry (03:00 UTC nightly):"
crontab -u root -l | grep -A1 "$CRON_MARKER"
echo "[install-backup] backups will land in $BACKUP_DIR, log at $LOG_FILE"
echo "[install-backup] run a smoke test: sudo $SCRIPT_DST"
