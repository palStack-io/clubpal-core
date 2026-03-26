#!/bin/bash
set -euo pipefail

DATE=$(date -u +%Y-%m-%d-%H%M)
BACKUP_DIR=/backups/postgres
LOGFILE=/backups/backup.log
RETENTION=${BACKUP_PG_RETENTION_DAYS:-14}

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [postgres] $*" | tee -a "$LOGFILE"; }

log "Starting backup..."

export PGPASSWORD="${POSTGRES_PASSWORD:-clubpal}"
pg_dumpall \
  --host="${POSTGRES_HOST:-db}" \
  --username="${POSTGRES_USER:-clubpal}" \
  | gzip > "$BACKUP_DIR/clubpal-$DATE.sql.gz"

SIZE=$(du -sh "$BACKUP_DIR/clubpal-$DATE.sql.gz" | cut -f1)
log "Dump complete: clubpal-$DATE.sql.gz ($SIZE)"

# Remove local copies older than retention period
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${RETENTION}" -delete
log "Local cleanup done (keeping last ${RETENTION} days)"

# Sync to remote if configured
if [ -n "${BACKUP_REMOTE_BUCKET:-}" ]; then
  log "Syncing to remote: ${BACKUP_REMOTE_BUCKET}/postgres/"
  rclone copy "$BACKUP_DIR" "remote:${BACKUP_REMOTE_BUCKET}/postgres/" 2>&1 | tee -a "$LOGFILE"
  log "Remote sync complete"
fi

# Optional dead man's switch ping (healthchecks.io or similar)
if [ -n "${BACKUP_HEALTHCHECK_URL:-}" ]; then
  curl -fsS --retry 3 "${BACKUP_HEALTHCHECK_URL}" > /dev/null
fi

log "Done"
