#!/usr/bin/env bash
# Nightly Postgres backup for the inventory database.
# Dumps to a temp file, verifies it, then renames it and prunes old backups.
# Keeps the newest KEEP backups; never deletes anything if the new dump fails.
set -euo pipefail

ENV_FILE="/var/www/inventory/api/.env"
BACKUP_DIR="$HOME/db-backups"
KEEP=7
LOG="$BACKUP_DIR/backup.log"

mkdir -p "$BACKUP_DIR"
log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }

TMP="$BACKUP_DIR/.inventory-in-progress.dump"
trap 'rm -f "$TMP"' EXIT

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
DATABASE_URL="${DATABASE_URL%%\?*}"
if [ -z "$DATABASE_URL" ]; then log "FAILED: DATABASE_URL not found"; exit 1; fi

if ! pg_dump -Fc "$DATABASE_URL" -f "$TMP" 2>>"$LOG"; then
  log "FAILED: pg_dump error; old backups kept"; exit 1
fi
if ! pg_restore --list "$TMP" >/dev/null 2>>"$LOG"; then
  log "FAILED: dump did not verify; old backups kept"; exit 1
fi

FINAL="$BACKUP_DIR/inventory-$(date -u +%Y%m%d-%H%M%S).dump"
mv "$TMP" "$FINAL"
chmod 600 "$FINAL"
log "OK: created $(basename "$FINAL") ($(du -h "$FINAL" | cut -f1))"

# Offsite copy to private R2 bucket. A failure here is logged but never
# affects the local backup (which is already safely on disk).
UPLOAD_RC=0
if [ -f "$HOME/.backup-r2.env" ]; then
  if OUT="$(/usr/bin/node /var/www/inventory/scripts/upload-backup.js "$FINAL" 2>&1)"; then
    log "OK offsite: $(echo "$OUT" | tr '\n' ' ')"
  else
    log "FAILED offsite upload: $(echo "$OUT" | tr '\n' ' ')"
    UPLOAD_RC=1
  fi
else
  log "SKIPPED offsite upload: ~/.backup-r2.env not found"
fi

# Prune: keep newest $KEEP inventory-*.dump files only.
ls -1t "$BACKUP_DIR"/inventory-*.dump | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f -- "$old" && log "pruned $(basename "$old")"
done

exit "$UPLOAD_RC"
