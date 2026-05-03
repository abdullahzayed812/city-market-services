#!/bin/sh
set -e

MYSQL="mysql -h mysql -uroot -p${MYSQL_ROOT_PASSWORD} --batch"

apply() {
  local db="$1"
  local file="$2"
  echo "[db-init] Applying schema: $db"
  # Normalize all CREATE TABLE to CREATE TABLE IF NOT EXISTS (idempotent)
  sed 's/CREATE TABLE[[:space:]]\+\(IF NOT EXISTS[[:space:]]\+\)\?/CREATE TABLE IF NOT EXISTS /g' "$file" \
    | $MYSQL "$db"
}

apply auth_db         /schemas/auth-service.sql
apply user_db         /schemas/user-service.sql
apply vendor_db       /schemas/vendor-service.sql
apply catalog_db      /schemas/catalog-service.sql
apply order_db        /schemas/order-service.sql
apply delivery_db     /schemas/delivery-service.sql
apply notification_db /schemas/notification-service.sql
apply payment_db      /schemas/payment-service.sql
apply rating_db       /schemas/rating-service.sql

echo "[db-init] All schemas applied."
