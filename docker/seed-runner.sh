#!/bin/sh
set -e

# Sentinel: if any users exist, seeds have already been applied
SEEDED=$(mysql -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" auth_db \
  -sN -e "SELECT COUNT(*) FROM users" 2>/dev/null || echo "0")

if [ "$SEEDED" -gt "0" ]; then
  echo "[db-seed] Data already exists ($SEEDED users). Skipping seeds."
  exit 0
fi

echo "[db-seed] Fresh database detected. Running seeds..."

seed() {
  local service="$1"
  local db="$2"
  echo "[db-seed] Seeding $db..."
  DB_NAME="$db" node "/app/services/$service/dist/infrastructure/database/seed-db.js"
  echo "[db-seed] Done: $db"
}

seed auth-service     auth_db
seed user-service     user_db
seed order-service    order_db
seed vendor-service   vendor_db
seed catalog-service  catalog_db
seed delivery-service delivery_db

echo "[db-seed] All seeds applied successfully."
