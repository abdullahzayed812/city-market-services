# Production Setup — Full Explanation

This document explains every change made during the production deployment setup.
Read this to understand *why* each file exists and *what* each part does.

---

## What Was Explored First

Before writing anything, the entire codebase was mapped to find:
- How many services exist (11, not 6)
- Ports each service runs on
- Which services use RabbitMQ, Redis, Firebase
- What Dockerfiles already existed
- What `.env` variables were already referenced

Every port number, queue name, and environment variable in the output files is real — pulled directly from the code.

---

## Critical Bug Fixed — `docker/mysql/init.sql`

**The problem:** When MySQL Docker starts, it creates the user from `MYSQL_USER` but only grants that user access to the database in `MYSQL_DATABASE`. The compose file sets `MYSQL_DATABASE: auth_db`, so the `citymarket` user only had access to `auth_db`.

The init.sql created all 10 databases but never granted the `citymarket` user access to them. In production, every service except `auth-service` would fail with "Access denied" when connecting to its database.

**The fix:**

```sql
GRANT ALL PRIVILEGES ON vendor_db.* TO 'citymarket'@'%';
-- ... for all 10 databases
FLUSH PRIVILEGES;
```

---

## `docker-compose.yml` Changes

### A) Redis Persistence

Before: Redis had no volume. Every restart wiped all cached data.

```yaml
command: redis-server --save 60 1 --loglevel warning
volumes:
  - redis_data:/data
```

`--save 60 1` means: snapshot to disk if at least 1 key changed in 60 seconds.

### B) Redis Password Support

Before: Redis had no authentication. Anyone who reached port 6380 could read/write all data.

```yaml
command: redis-server ... ${REDIS_PASSWORD:+--requirepass $REDIS_PASSWORD}
```

The `${REDIS_PASSWORD:+--requirepass $REDIS_PASSWORD}` bash syntax means: only add `--requirepass` if the variable is set. Backwards-compatible — empty `REDIS_PASSWORD` runs without auth (dev), set it and auth is enforced.

### C) Firebase Credentials File Mount

Before: The only way to provide Firebase credentials was to paste the entire JSON as a string. Messy and unsafe.

```yaml
volumes:
  - ${FIREBASE_CREDENTIALS_FILE:-/dev/null}:/run/secrets/firebase-service-account.json:ro
```

Now you place `firebase-credentials.json` on the server, set `FIREBASE_CREDENTIALS_FILE=./firebase-credentials.json` in `.env`, and it's mounted read-only into the container at a predictable path. If not set, it mounts `/dev/null` (harmless empty file) so compose doesn't break.

### D) Log Rotation for All Services

```yaml
x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "20m"
    max-file: "5"
```

This is a YAML anchor — defined once, reused in every service via `logging: *default-logging`. Without this, Docker logs grow forever and can fill your VPS disk. This caps each service at 5 files × 20MB = 100MB max per service.

---

## `nginx/nginx.conf` Changes

### A) Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=api:10m  rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=ws:10m   rate=5r/m;
```

Three zones:
- `api` — 60 requests/minute per IP for general API routes
- `auth` — 10 requests/minute per IP (brute-force protection on login/register)
- `ws` — 5 WebSocket connection upgrades/minute per IP

`burst=30 nodelay` allows a burst of up to 30 extra requests instantly before rate limiting kicks in — prevents false positives on normal usage spikes.

### B) Gzip Compression

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

Compresses API responses before sending. For JSON-heavy APIs this typically reduces payload size by 60–80%.

### C) Security Headers

```nginx
add_header X-Frame-Options        "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection       "1; mode=block";
add_header Referrer-Policy        "strict-origin-when-cross-origin";
```

Browser-enforced protections:
- `X-Frame-Options` — prevents your app from being embedded in iframes (clickjacking protection)
- `X-Content-Type-Options` — prevents browsers from guessing content types (MIME sniffing attacks)
- `X-XSS-Protection` — enables browser's built-in XSS filter
- `Referrer-Policy` — controls what URL is sent in the `Referer` header

### D) Proxy Timeouts

```nginx
proxy_connect_timeout 10s;
proxy_send_timeout    30s;
proxy_read_timeout    30s;
```

Without these, a slow service can hold nginx connections open indefinitely, eventually exhausting the worker pool.

### E) Silent Health Check Logs

```nginx
location /health {
    access_log off;
}
```

Health checks are hit every few seconds by monitoring tools. Without `access_log off`, they spam your logs with noise.

---

## `nginx/nginx.ssl.conf` — New File

This is the production SSL config. It's a separate file (not replacing the HTTP one) because you deploy HTTP first, get DNS working, then switch to HTTPS.

### HTTP → HTTPS Redirect

```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

Every HTTP request gets a permanent redirect to HTTPS.

### TLS Hardening

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers   ECDHE-ECDSA-AES128-GCM-SHA256:...;
ssl_session_tickets off;
ssl_stapling on;
```

- Disables old TLS 1.0/1.1 (vulnerable to POODLE, BEAST attacks)
- Uses only strong cipher suites
- Disables session tickets (prevents session resumption attacks)
- Enables OCSP stapling (faster cert validation for clients)

### HSTS Header

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
```

Tells browsers: "only connect to this domain over HTTPS for the next 2 years." Once set, even if the redirect breaks, browsers won't make HTTP connections.

### ACME Challenge Route

```nginx
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

Required for Let's Encrypt certificate renewal. Certbot places a file here to prove domain ownership.

The config uses `DOMAIN_PLACEHOLDER` as a text token. The deploy script replaces it with your actual domain via `sed` before applying it.

---

## `.env.example` Changes

Added:
- `DOMAIN=yourdomain.com` — needed for SSL config generation and CORS
- `REDIS_PASSWORD` — for Redis auth
- `FIREBASE_CREDENTIALS_FILE` — for the volume mount
- Changed all secrets from weak defaults to `change_me_*` — makes it obvious what must be changed
- Updated `VITE_*` URLs to use `https://` — dashboards in production should point to the HTTPS domain

---

## `scripts/backup-mysql.sh` — New File

What it does step by step:

1. Loads `.env` if running outside Docker
2. Loops through all 10 databases
3. For each: runs `mysqldump --single-transaction` piped directly into `gzip -9` — no intermediate uncompressed file on disk
4. Names files `{db}_{timestamp}.sql.gz`
5. Deletes backups older than `KEEP_DAYS` (default 7) using `find -mtime`
6. If `RCLONE_REMOTE` is set, uploads today's backups to S3/R2 via `rclone`

`--single-transaction` starts a transaction before dumping, giving a consistent snapshot without locking tables. Without it, writes during the dump could produce corrupted backup data.

---

## `scripts/deploy.sh` — New File

A single script that handles the full deployment lifecycle.

### `./scripts/deploy.sh` — First Deploy

1. Checks Docker is installed
2. If `.env` doesn't exist, copies from `.env.example` and exits (forces you to fill it out)
3. Warns if `change_me_*` values are still present
4. Builds all Docker images with `--pull` (gets latest base images)
5. Starts MySQL, Redis, RabbitMQ first — waits for each to be healthy
6. Runs auth-service DB migrations
7. Starts all remaining services
8. Waits 30 seconds for stabilization
9. Runs health checks against all 11 service endpoints
10. Adds daily backup cron at 3 AM

### `./scripts/deploy.sh --ssl` — Enable HTTPS

- Stops nginx temporarily (frees port 80 for certbot's standalone challenge)
- Runs certbot to obtain the certificate
- Injects your domain into the SSL nginx config via `sed`
- Reloads nginx with the SSL config
- Adds certbot renewal cron

### `./scripts/deploy.sh --update` — Rolling Update

- `git pull`
- Rebuilds changed images
- `docker compose up -d` (Docker Compose handles the rolling restart)

---

## `DEPLOYMENT.md` — New File

A step-by-step human guide covering:
- Server requirements (min 4GB RAM, 40GB disk)
- Docker installation commands
- How to generate cryptographically strong secrets
- Firebase setup walkthrough
- First deploy → domain → SSL flow
- How to update the running system
- Firewall setup with UFW
- SSH tunnel trick for accessing internal dashboards securely
- Common troubleshooting commands

---

## `PRODUCTION_CHECKLIST.md` — New File

40 checkboxes organized into 6 categories:

1. **Security** — all secrets changed, firewall, SSL, no secrets in git
2. **Infrastructure** — all containers healthy, all databases exist, grants work
3. **Services** — curl each of the 11 service health endpoints
4. **Features** — end-to-end test: register → place order → receive notification → WebSocket broadcast
5. **Observability** — no ERROR logs at startup, RabbitMQ queues exist, log rotation active
6. **Domains & SSL** — HTTPS works, redirect works, cert not expired, renewal cron active

---

## What Was Already Good (Not Touched)

| File | Why it was left alone |
|------|-----------------------|
| `Dockerfile.service` | 3-stage build was correct and efficient |
| `Dockerfile.webapp` | Fine as-is |
| All 11 service Dockerfiles | Correct |
| `docker-compose.yml` service routing | All env vars, depends_on, healthchecks were correct |
| `nginx/nginx.conf` routing | All proxy_pass rules and WebSocket upgrade headers were correct |
| RabbitMQ setup | Durable queues, DLX pattern, connection retry in shared lib — all good |

---

## File Map — What Does What

```
docker-compose.yml          — Orchestrates all containers
Dockerfile.service          — Generic 3-stage build for all Node.js services
Dockerfile.webapp           — Build for React dashboards (served by nginx)
nginx/
  Dockerfile                — Builds the nginx API gateway image
  nginx.conf                — HTTP config with rate limiting + security headers
  nginx.ssl.conf            — HTTPS config (apply after getting SSL cert)
docker/mysql/
  init.sql                  — Creates all 10 databases + grants permissions
scripts/
  deploy.sh                 — Full deployment automation (first deploy / SSL / update)
  backup-mysql.sh           — Daily database backup with gzip + optional cloud upload
.env.example                — Template for all required environment variables
DEPLOYMENT.md               — Step-by-step deployment guide
PRODUCTION_CHECKLIST.md     — 40-point go-live checklist
```
