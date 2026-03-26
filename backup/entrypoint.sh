#!/bin/bash
set -euo pipefail

CRONTAB=/tmp/crontab
LOGFILE=/backups/backup.log

mkdir -p /backups/postgres /backups/minio

# Build crontab from env vars — supercronic passes the full env to each job
cat > "$CRONTAB" <<EOF
${BACKUP_PG_SCHEDULE:-0 3 * * *} /scripts/backup-pg.sh
${BACKUP_MINIO_SCHEDULE:-0 4 * * *} /scripts/backup-minio.sh
EOF

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup service starting" | tee -a "$LOGFILE"
echo "  Postgres schedule : ${BACKUP_PG_SCHEDULE:-0 3 * * *}"    | tee -a "$LOGFILE"
echo "  MinIO schedule    : ${BACKUP_MINIO_SCHEDULE:-0 4 * * *}" | tee -a "$LOGFILE"
echo "  PG retention      : ${BACKUP_PG_RETENTION_DAYS:-14} days"    | tee -a "$LOGFILE"
echo "  MinIO retention   : ${BACKUP_MINIO_RETENTION_DAYS:-7} days"  | tee -a "$LOGFILE"
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  echo "  Remote            : ${RCLONE_CONFIG_REMOTE_TYPE:-?} → ${BACKUP_REMOTE_BUCKET}" | tee -a "$LOGFILE"
else
  echo "  Remote            : disabled (set BACKUP_REMOTE_BUCKET to enable)" | tee -a "$LOGFILE"
fi

exec supercronic "$CRONTAB"
