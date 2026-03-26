#!/bin/bash
set -euo pipefail

DATE=$(date -u +%Y-%m-%d-%H%M)
BACKUP_DIR=/backups/minio
LOGFILE=/backups/backup.log
RETENTION=${BACKUP_MINIO_RETENTION_DAYS:-7}
MINIO_DATA=/minio-data

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [minio] $*" | tee -a "$LOGFILE"; }

log "Starting backup..."

tar czf "$BACKUP_DIR/minio-$DATE.tar.gz" -C "$MINIO_DATA" .

SIZE=$(du -sh "$BACKUP_DIR/minio-$DATE.tar.gz" | cut -f1)
log "Snapshot complete: minio-$DATE.tar.gz ($SIZE)"

# Remove local copies older than retention period
find "$BACKUP_DIR" -name "minio-*.tar.gz" -mtime "+${RETENTION}" -delete
log "Local cleanup done (keeping last ${RETENTION} days)"

# Sync to remote if configured
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  log "Syncing to remote: ${BACKUP_REMOTE_BUCKET}/minio/"
  rclone copy "$BACKUP_DIR" "remote:${BACKUP_REMOTE_BUCKET}/minio/" 2>&1 | tee -a "$LOGFILE"
  log "Remote sync complete"
fi

# Optional dead man's switch ping
if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
  curl -fsS --retry 3 "${BACKUP_HEALTHCHECK_URL}" > /dev/null
fi

log "Done"
