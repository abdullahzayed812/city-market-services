# Docker — CityMarket

This document explains how the entire application is containerized: what every Dockerfile does, how `docker-compose.yml` wires every service together, and how to operate the stack day-to-day.

---

## Architecture Overview

```
Browser / Mobile App
        │
        ▼
┌───────────────────┐   port 80 / 443
│   nginx (gateway) │  ◄──────────────── single public entry point
└───────────────────┘
        │  rewrites URL, proxies to internal service
        ▼
┌─────────────────────────────────────────────────────┐
│                  Docker network: citymarket          │
│                                                     │
│  auth-service:3001    user-service:3002             │
│  vendor-service:3003  catalog-service:3004          │
│  order-service:3005   delivery-service:3006         │
│  admin-service:3007   notification-service:3008     │
│  payment-service:3009 rating-service:3010           │
│  websocket-gateway:3011                             │
│                                                     │
│  mysql:3306    redis:6379    rabbitmq:5672           │
└─────────────────────────────────────────────────────┘

Dashboards (each their own container, own nginx):
  admin-dashboard    → port 8080
  vendor-dashboard   → port 8083
  delivery-dashboard → port 8082
```

All backend services live **only** on the internal Docker network — they are never reachable from outside. The only public-facing ports are:

| Port  | What listens                              |
| ----- | ----------------------------------------- |
| 80    | Nginx API gateway (443 with SSL)          |
| 8080  | Admin dashboard                           |
| 8082  | Delivery dashboard                        |
| 8083  | Vendor dashboard                          |
| 3307  | MySQL (dev only — for tools like DBeaver) |
| 6380  | Redis (dev only)                          |
| 5673  | RabbitMQ AMQP (dev only)                  |
| 15673 | RabbitMQ Management UI (dev only)         |

---

## Dockerfiles

### `Dockerfile.service` — All 11 backend services

One Dockerfile builds every Node.js service. Two build args tell it which one to build:

```
ARG SERVICE_PATH   e.g.  services/auth-service
ARG SERVICE_MAIN   e.g.  dist/server.js
```

It has three stages:

```
Stage 1: deps  (node:20-alpine)
  └─ Copies root package.json + every workspace package.json
  └─ Runs: npm ci
       → produces one shared node_modules/ for the whole monorepo

Stage 2: builder  (node:20-alpine)
  └─ Copies node_modules/ from stage 1
  └─ Builds @city-market/shared first  →  shared/dist/
  └─ Deletes shared/src/ and shared/tsconfig.json
  └─ Copies the target service directory
  └─ Runs: npm run build  →  dist/

Stage 3: runtime  (node:20-alpine — clean, no build tools)
  └─ Copies from builder:
       node_modules/                     (includes @city-market/shared symlink)
       shared/                           (compiled dist only, no source)
       services/<name>/dist/
       services/<name>/package.json
  └─ Sets NODE_ENV=production
  └─ CMD: node $SERVICE_MAIN
```

**Why copy all `package.json` files before `npm ci`?**
Docker caches each instruction as a layer. Copying only `package.json` files first means the `npm ci` layer is only invalidated when a dependency actually changes — not when any source file changes. This makes rebuilds much faster.

**Why delete `shared/src` after building it?**
The monorepo uses TypeScript workspace paths. If source files remain, `tsc` inside a service can accidentally cross the workspace boundary and fail with `rootDir` errors. Removing the source forces every service to resolve `@city-market/shared` through `dist/` only, which is the compiled output.

---

### `Dockerfile.webapp` — React dashboards (admin, vendor, delivery)

One Dockerfile builds all three Vite/React dashboards. Build arg `WEB_APP` selects which one:

```
ARG WEB_APP   e.g.  admin-dashboard
```

Three environment variables are baked into the JS bundle at build time:

```
VITE_API_URL          URL of the nginx gateway   (e.g. https://yourdomain.com/api/v1)
VITE_API_BASE_URL     Same — used by some SDK helpers
VITE_WEBSOCKET_URL    Root URL for Socket.IO     (e.g. https://yourdomain.com)
```

These **cannot be changed at runtime** — Vite inlines them during the build. You must rebuild the image if the domain changes.

Two stages:

```
Stage 1: builder  (node:20-alpine)
  └─ Installs all workspace dependencies
  └─ Builds @city-market/shared
  └─ Copies web/<WEB_APP>/
  └─ Runs: npm run build  →  web/<WEB_APP>/dist/  (static HTML/JS/CSS)

Stage 2: runtime  (nginx:1.27-alpine)
  └─ Copies dist/ → /usr/share/nginx/html
  └─ Copies web/<WEB_APP>/nginx.conf → /etc/nginx/conf.d/default.conf
  └─ Exposes port 80
```

The final image is a pure nginx container serving static files — no Node.js at runtime.

---

### `nginx/Dockerfile` — API gateway container

```dockerfile
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
```

SSL certificates are **not baked in**. When HTTPS is enabled via `deploy.sh --ssl`, the Let's Encrypt certificate files are mounted from the host at runtime.

---

## docker-compose.yml

### Shared defaults (YAML anchors)

Two reusable blocks avoid repeating config on every service:

**`x-service-defaults`** — services that need MySQL + Redis only:

```yaml
restart: unless-stopped
networks: [citymarket]
depends_on:
  mysql:  condition: service_healthy
  redis:  condition: service_healthy
```

**`x-rabbitmq-service`** — services that also need RabbitMQ:

```yaml
restart: unless-stopped
networks: [citymarket]
depends_on:
  mysql:    condition: service_healthy
  redis:    condition: service_healthy
  rabbitmq: condition: service_healthy
```

Services using RabbitMQ: `catalog-service`, `order-service`, `notification-service`, `rating-service`, `websocket-gateway`.

`condition: service_healthy` means Docker waits for the healthcheck to pass before starting the dependent service. A service will never boot while the database is still initializing.

---

### Infrastructure services

#### MySQL

```yaml
image: mysql:8.0
ports: ["3307:3306"]
volumes:
  - mysql_data:/var/lib/mysql
  - ./docker/mysql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

`init.sql` runs once on the very first container start and creates all 10 service databases (`auth_db`, `user_db`, `vendor_db`, ...) and grants the `citymarket` user access to all of them.

Healthcheck: `mysqladmin ping` — no service starts until MySQL is responding.

#### Redis

```yaml
image: redis:7-alpine
ports: ["6380:6379"]
command: redis-server --save 60 1 --loglevel warning [--requirepass ...]
```

`--save 60 1` = persist to disk if at least 1 key changed in 60 seconds. Password is optional — set `REDIS_PASSWORD` in `.env` to enable auth.

#### RabbitMQ

```yaml
image: rabbitmq:3.13-management-alpine
ports:
  - "5673:5672" # AMQP
  - "15673:15672" # Management UI → http://localhost:15673
```

Services communicate asynchronously via RabbitMQ. For example: when an order is placed, `order-service` publishes an event and `notification-service` consumes it to send a push notification.

---

### Backend service pattern

Every backend service follows the same structure:

```yaml
auth-service:
  <<: *service-defaults          # inherits restart, network, depends_on
  build:
    context: .                   # monorepo root — needed so Dockerfile can COPY shared/
    dockerfile: Dockerfile.service
    args:
      SERVICE_PATH: services/auth-service
      SERVICE_MAIN: dist/server.js
  environment:
    PORT: 3001
    DB_HOST: mysql               # Docker internal DNS — resolves to the mysql container
    DB_PORT: 3306
    DB_NAME: auth_db
    ...
```

`DB_HOST: mysql` works because Docker's internal DNS resolves service names to container IPs within the same network. So `auth-service` reaches `mysql`, and `order-service` reaches `catalog-service:3004` — all without knowing any real IPs.

No backend service has a `ports:` entry. They are **not reachable from outside Docker**. Only nginx (which is on the same network) can proxy to them.

---

### Nginx service

```yaml
nginx:
  build:
    context: ./nginx
    dockerfile: Dockerfile
  ports:
    - "80:80"
  depends_on:
    - auth-service
    - user-service
    - ... (all 11 services)
```

Nginx starts after all services are up, but uses lazy DNS resolution (`resolver 127.0.0.11`) so a backend service crashing after startup doesn't bring nginx down.

---

### Web dashboard services

```yaml
admin-dashboard:
  build:
    context: .
    dockerfile: Dockerfile.webapp
    args:
      WEB_APP: admin-dashboard
      VITE_API_URL: ${VITE_API_URL:-http://localhost/api/v1}
  ports:
    - "8080:80"
```

These are completely independent from the nginx API gateway. Each is its own container serving static files. The browser (not Docker) makes API calls to the gateway URL stored in `VITE_API_URL`.

---

### Network and volumes

```yaml
networks:
  citymarket:
    driver: bridge # all containers share one private network

volumes:
  mysql_data: # MySQL data — survives container restarts
  redis_data: # Redis persistence
  rabbitmq_data: # RabbitMQ queues and messages
```

Named volumes are stored by Docker on the host at `/var/lib/docker/volumes/`. They survive `docker compose down` but are deleted by `docker compose down -v`.

---

### Log rotation

Every container uses this logging config (applied via the `x-logging` YAML anchor):

```yaml
logging:
  driver: json-file
  options:
    max-size: "20m" # rotate when a log file hits 20 MB
    max-file: "5" # keep the last 5 rotated files → max 100 MB per service
```

Without this, a busy service could fill the host disk. With it, each service uses at most 100 MB of log storage.

---

## Environment Variables

All secrets and config live in the root `.env` file. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

| Variable                              | Used by               | Purpose                          |
| ------------------------------------- | --------------------- | -------------------------------- |
| `MYSQL_ROOT_PASSWORD`                 | MySQL                 | Root DB access                   |
| `DB_USER` / `DB_PASSWORD`             | All services          | App DB credentials               |
| `REDIS_PASSWORD`                      | Redis, all services   | Redis auth (optional)            |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | RabbitMQ, consumers   | Message broker auth              |
| `JWT_ACCESS_SECRET`                   | auth-service          | Signs access tokens              |
| `JWT_REFRESH_SECRET`                  | auth-service          | Signs refresh tokens             |
| `JWT_SERVICE_ACCESS_SECRET`           | auth-service          | Signs service-to-service tokens  |
| `*_SERVICE_CLIENT_SECRET`             | Each service          | OAuth2 client credentials        |
| `FIREBASE_SERVICE_ACCOUNT_JSON`       | notification-service  | Firebase push notifications      |
| `VITE_API_URL`                        | Dashboard build args  | API URL baked into the JS bundle |
| `DOMAIN`                              | deploy.sh, SSL config | Your public domain name          |

---

## Common Commands

```bash
# Start the full stack
docker compose up -d

# Start only infrastructure (DB, cache, broker) — useful during development
docker compose up -d mysql redis rabbitmq

# Rebuild a single service after a code change
docker compose build catalog-service

# Follow logs of a service
docker compose logs -f order-service

# Run a one-off command inside a service container (e.g. seed the DB)
docker compose run --rm catalog-service node dist/infrastructure/database/seed-db.js

# Restart nginx after a config change
docker compose restart nginx

# Stop everything (data volumes are preserved)
docker compose down

# Stop everything and wipe all data volumes
docker compose down -v

# Check which containers are running and their status
docker compose ps
```

● From the docker-compose ports you already have:

Dashboards (browser):

┌───────────┬───────────────────────┐  
 │ Dashboard │ URL │  
 ├───────────┼───────────────────────┤  
 │ Admin │ http://localhost:8080 │
├───────────┼───────────────────────┤  
 │ Delivery │ http://localhost:8082 │
├───────────┼───────────────────────┤
│ Vendor │ http://localhost:8083 │
└───────────┴───────────────────────┘

Each dashboard is its own nginx container serving a Vite SPA directly.

Mobile apps:

http://<server-ip>/api/v1

- If running locally on the same machine: http://localhost/api/v1 — but a phone on the same WiFi network can't reach localhost on your laptop.
- For a phone on the same network: use your machine's local IP (e.g. http://192.168.1.x/api/v1). Find it with ip addr show or hostname -I.
- For production on a VPS: http://<public-ip>/api/v1 or https://yourdomain.com/api/v1 once SSL is set up.  


The WebSocket URL for mobile (real-time order updates) is the same host without the path:  
 http://<server-ip> ← Socket.IO connects to nginx which proxies to websocket-gateway:3011

These are already the defaults baked into the web app build args in docker-compose:  
 VITE_API_URL: ${VITE_API_URL:-http://localhost/api/v1}  
 VITE_WEBSOCKET_URL: ${VITE_WEBSOCKET_URL:-http://localhost}

So for a phone, set these in your .env before building:  
 VITE_API_URL=http://192.168.1.x/api/v1  
 VITE_API_BASE_URL=http://192.168.1.x/api/v1  
 VITE_WEBSOCKET_URL=http://192.168.1.x
