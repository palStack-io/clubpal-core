#!/bin/bash
set -euo pipefail

CRONTAB=/tmp/crontab
LOGFILE=/backups/backup.log

mkdir -p /backups/postgres /backups/garage

# Build crontab from env vars — supercronic passes the full env to each job
cat > "$CRONTAB" <<EOF
${BACKUP_PG_SCHEDULE:-0 3 * * *} /scripts/backup-pg.sh
${BACKUP_STORAGE_SCHEDULE:-0 4 * * *} /scripts/backup-storage.sh
EOF

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup service starting" | tee -a "$LOGFILE"
echo "  Postgres schedule : ${BACKUP_PG_SCHEDULE:-0 3 * * *}"        | tee -a "$LOGFILE"
echo "  Garage schedule   : ${BACKUP_STORAGE_SCHEDULE:-0 4 * * *}"   | tee -a "$LOGFILE"
echo "  PG retention      : ${BACKUP_PG_RETENTION_DAYS:-14} days"    | tee -a "$LOGFILE"
echo "  Garage retention  : ${BACKUP_STORAGE_RETENTION_DAYS:-7} days" | tee -a "$LOGFILE"
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  echo "  Remote            : ${RCLONE_CONFIG_REMOTE_TYPE:-?} → ${BACKUP_REMOTE_BUCKET}" | tee -a "$LOGFILE"
else
  echo "  Remote            : disabled (set BACKUP_REMOTE_BUCKET to enable)" | tee -a "$LOGFILE"
fi

exec supercronic "$CRONTAB"
