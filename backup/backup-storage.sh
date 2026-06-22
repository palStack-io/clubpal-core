#!/bin/bash
set -euo pipefail

DATE=$(date -u +%Y-%m-%d-%H%M)
BACKUP_DIR=/backups/garage
LOGFILE=/backups/backup.log
RETENTION=${BACKUP_STORAGE_RETENTION_DAYS:-7}
GARAGE_DATA=/garage-data

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [garage] $*" | tee -a "$LOGFILE"; }

log "Starting backup..."

tar czf "$BACKUP_DIR/garage-$DATE.tar.gz" -C "$GARAGE_DATA" .

SIZE=$(du -sh "$BACKUP_DIR/garage-$DATE.tar.gz" | cut -f1)
log "Snapshot complete: garage-$DATE.tar.gz ($SIZE)"

# Remove local copies older than retention period
find "$BACKUP_DIR" -name "garage-*.tar.gz" -mtime "+${RETENTION}" -delete
log "Local cleanup done (keeping last ${RETENTION} days)"

# Sync to remote if configured
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  log "Syncing to remote: ${BACKUP_REMOTE_BUCKET}/garage/"
  rclone copy "$BACKUP_DIR" "remote:${BACKUP_REMOTE_BUCKET}/garage/" 2>&1 | tee -a "$LOGFILE"
  log "Remote sync complete"
fi

# Optional dead man's switch ping
if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
  curl -fsS --retry 3 "${BACKUP_HEALTHCHECK_URL}" > /dev/null
fi

log "Done"
