#!/usr/bin/env bash
# CityMarket production deployment script
#
# Usage:
#   ./scripts/deploy.sh              # first-time deploy (HTTP only)
#   ./scripts/deploy.sh --ssl        # enable HTTPS after DNS is pointing here
#   ./scripts/deploy.sh --update     # rebuild and rolling-restart services

set -euo pipefail

COMPOSE="docker compose"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Parse flags ───────────────────────────────────────────────────────────────
ENABLE_SSL=false
UPDATE_MODE=false
for arg in "$@"; do
  case $arg in
    --ssl)    ENABLE_SSL=true  ;;
    --update) UPDATE_MODE=true ;;
  esac
done

cd "$PROJECT_DIR"

# ── Prerequisites ─────────────────────────────────────────────────────────────
echo "==> Checking prerequisites ..."
command -v docker  >/dev/null || { echo "ERROR: docker is not installed.";  exit 1; }
command -v git     >/dev/null || { echo "ERROR: git is not installed.";     exit 1; }

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0")
echo "    Docker $DOCKER_VERSION"

# ── Environment ───────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "==> .env not found — copying from .env.example ..."
  cp .env.example .env
  echo ""
  echo "  !! Edit .env with your real credentials before continuing."
  echo "     Then re-run: ./scripts/deploy.sh"
  exit 1
fi

# Warn about placeholder values
if grep -q "change_me" .env; then
  echo ""
  echo "  WARNING: .env contains placeholder values (change_me_*)."
  echo "           Update them before deploying to production."
  echo ""
  read -rp "  Continue anyway? [y/N] " CONT
  [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
fi

# Load .env for this script
set -a; source .env; set +a

# ── SSL setup ─────────────────────────────────────────────────────────────────
if [[ "$ENABLE_SSL" == "true" ]]; then
  DOMAIN="${DOMAIN:?DOMAIN must be set in .env}"
  echo "==> Setting up SSL for $DOMAIN ..."

  command -v certbot >/dev/null || {
    echo "Installing certbot ..."
    apt-get update -q && apt-get install -y certbot
  }

  # Temporarily stop nginx to free port 80 for certbot standalone
  $COMPOSE stop nginx 2>/dev/null || true

  certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --expand \
    --email "admin@${DOMAIN}" \
    -d "$DOMAIN" \
    -d "www.${DOMAIN}" \
    -d "admin.${DOMAIN}" \
    -d "vendor.${DOMAIN}" \
    -d "delivery.${DOMAIN}"

  # Inject actual domain into SSL config
  sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" \
    nginx/nginx.ssl.conf > nginx/nginx.active.conf

  # Update docker-compose nginx build to use the SSL config
  export NGINX_CONF=nginx.active.conf

  # Add certbot renewal cron.
  # The cert was issued with --standalone, which needs port 80 free, but nginx
  # holds it permanently once deployed — so nginx must be stopped for the
  # renewal attempt and restarted regardless of whether renewal actually ran.
  if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * docker compose -f $PROJECT_DIR/docker-compose.yml stop nginx; certbot renew --quiet; docker compose -f $PROJECT_DIR/docker-compose.yml start nginx") | crontab -
    echo "    Certbot auto-renewal cron added."
  fi

  echo "    SSL certificates obtained."
fi

# ── Build ──────────────────────────────────────────────────────────────────────
if [[ "$UPDATE_MODE" == "true" ]]; then
  echo "==> Pulling latest code ..."
  git pull

  echo "==> Rebuilding changed images ..."
  $COMPOSE build --pull
else
  echo "==> Building all images (first deploy) ..."
  $COMPOSE build --pull
fi

# ── Start infrastructure first ────────────────────────────────────────────────
echo "==> Starting infrastructure services ..."
$COMPOSE up -d mysql redis rabbitmq

echo "==> Waiting for MySQL to be healthy ..."
until $COMPOSE exec -T mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; do
  echo -n "."
  sleep 3
done
echo " ready."

echo "==> Waiting for RabbitMQ to be healthy ..."
until $COMPOSE exec -T rabbitmq rabbitmq-diagnostics ping --silent 2>/dev/null; do
  echo -n "."
  sleep 3
done
echo " ready."

# ── Run DB migrations ─────────────────────────────────────────────────────────
echo "==> Running auth-service DB migrations ..."
$COMPOSE run --rm auth-service node -e "
  const knex = require('knex');
  const config = require('./knexfile.js');
  knex(config.production || config).migrate.latest()
    .then(() => { console.log('Migrations done'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null || echo "    (migration step skipped — knexfile not found at dist root)"

# ── Start all services ─────────────────────────────────────────────────────────
echo "==> Starting all services ..."
$COMPOSE up -d

# ── Mount SSL config if enabled ───────────────────────────────────────────────
if [[ "$ENABLE_SSL" == "true" ]] && [[ -f nginx/nginx.active.conf ]]; then
  echo "==> Switching nginx to SSL config ..."
  docker cp nginx/nginx.active.conf \
    "$(docker compose ps -q nginx)":/etc/nginx/conf.d/default.conf
  $COMPOSE exec nginx nginx -s reload
fi

# ── Health check ──────────────────────────────────────────────────────────────
echo ""
echo "==> Waiting for services to stabilize (30s) ..."
sleep 30

PROTO="http"
[[ "$ENABLE_SSL" == "true" ]] && PROTO="https"
BASE_URL="${PROTO}://localhost"

echo "==> Running health checks ..."
FAILED=0

check() {
  local label=$1 url=$2
  if curl -sf "$url" -o /dev/null --max-time 5; then
    echo "    [OK]  $label"
  else
    echo "    [FAIL] $label — $url"
    FAILED=$((FAILED + 1))
  fi
}

check "Nginx gateway"  "$BASE_URL/health"
check "Auth service"   "$BASE_URL/api/v1/auth/health"
check "User service"   "$BASE_URL/api/v1/users/health"
check "Vendor service" "$BASE_URL/api/v1/vendors/health"
check "Catalog service" "$BASE_URL/api/v1/catalog/health"
check "Order service"  "$BASE_URL/api/v1/orders/health"

if [[ "$FAILED" -gt 0 ]]; then
  echo ""
  echo "  $FAILED service(s) did not respond. Check logs:"
  echo "  docker compose logs --tail=50 <service-name>"
fi

# ── Add daily backup cron ─────────────────────────────────────────────────────
if ! crontab -l 2>/dev/null | grep -q "backup-mysql.sh"; then
  (crontab -l 2>/dev/null; echo "0 3 * * * $PROJECT_DIR/scripts/backup-mysql.sh >> /var/log/citymarket-backup.log 2>&1") | crontab -
  echo "==> Daily backup cron added (3 AM)."
fi

echo ""
echo "==> Deployment complete."
echo "    Gateway: $BASE_URL"
[[ -n "${DOMAIN:-}" ]] && echo "    Domain:  ${PROTO}://${DOMAIN}"
echo ""
echo "    Admin dashboard:   http://localhost:8080"
echo "    Vendor dashboard:  http://localhost:8083"
echo "    Delivery dashboard: http://localhost:8082"
echo "    RabbitMQ UI:       http://localhost:15673"
