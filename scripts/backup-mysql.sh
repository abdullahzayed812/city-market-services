#!/usr/bin/env bash
# Daily MySQL backup — dumps all service databases, gzips, and optionally
# uploads to S3-compatible storage (Cloudflare R2, AWS S3, etc.) via rclone.
#
# Usage:
#   ./scripts/backup-mysql.sh              # local backup only
#   RCLONE_REMOTE=r2:my-bucket ./scripts/backup-mysql.sh  # + upload
#
# Cron example (3 AM daily):
#   0 3 * * * /opt/citymarket/scripts/backup-mysql.sh >> /var/log/citymarket-backup.log 2>&1

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/citymarket/mysql}"
KEEP_DAYS="${KEEP_DAYS:-7}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"          # e.g. r2:my-bucket/citymarket/mysql

# Load .env if running outside Docker
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"
DB_USER="${DB_USER:-citymarket}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"

DATABASES=(
  auth_db user_db vendor_db catalog_db order_db
  delivery_db admin_db notification_db payment_db rating_db
)

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting MySQL backup → $BACKUP_DIR"

for DB in "${DATABASES[@]}"; do
  OUT="$BACKUP_DIR/${DB}_${TIMESTAMP}.sql.gz"
  echo "  Dumping $DB ..."
  mysqldump \
    -h "$DB_HOST" \
    -P "$DB_PORT" \
    -u "$DB_USER" \
    -p"$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    "$DB" | gzip -9 > "$OUT"
  echo "  → $OUT ($(du -sh "$OUT" | cut -f1))"
done

# ── Cleanup old backups ───────────────────────────────────────────────────────
echo "Removing backups older than ${KEEP_DAYS} days ..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${KEEP_DAYS}" -delete

# ── Upload to cloud storage ───────────────────────────────────────────────────
if [[ -n "$RCLONE_REMOTE" ]]; then
  if ! command -v rclone &>/dev/null; then
    echo "WARNING: RCLONE_REMOTE is set but rclone is not installed. Skipping upload."
  else
    echo "Uploading to $RCLONE_REMOTE ..."
    rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" \
      --include "*_${TIMESTAMP}.sql.gz" \
      --progress
    echo "Upload complete."
  fi
fi

echo "[$(date -Iseconds)] Backup finished."
