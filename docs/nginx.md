# Nginx — CityMarket

This document explains the Nginx configuration: API gateway routing, rate limiting, WebSocket, SSL, and dashboard static file serving.

---

## Overview

CityMarket uses Nginx in two roles:

| Role | Config file | Container |
|------|------------|-----------|
| **API gateway** | `nginx/nginx.conf` (HTTP) or `nginx/nginx.ssl.conf` (HTTPS) | `nginx` service in docker-compose |
| **SPA file server** | `web/*/nginx.conf` | Built into each dashboard image |

---

## API Gateway (`nginx/nginx.conf`)

The single entry point for all API traffic. Runs on port 80 (or 443 with SSL) and proxies each request to the correct backend service based on the URL path.

### Rate Limiting

Three zones protect different endpoint groups from abuse:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m  rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=ws:10m   rate=5r/m;
limit_req_status 429;
```

| Zone | Rate | Applied to |
|------|------|-----------|
| `api` | 60 req/min (1/sec) | All general API routes |
| `auth` | 10 req/min | Login, register, token refresh |
| `ws` | 5 req/min | WebSocket connection attempts |

`10m` = 10 MB of shared memory, enough to track ~160,000 client IPs simultaneously.
`$binary_remote_addr` stores the IP in 4 bytes instead of 15, saving memory.
`limit_req_status 429` returns HTTP 429 (Too Many Requests) instead of the default 503.

Each `location` block adds a `burst` allowance:
```nginx
limit_req zone=api burst=30 nodelay;
```
`burst=30` allows a short spike of up to 30 extra requests before rejecting. `nodelay` processes burst requests immediately rather than queuing them.

---

### URL Rewriting and Proxying

Every API route strips the `/api/v1/<service>/` prefix before forwarding to the backend:

```nginx
location /api/v1/catalog/ {
    limit_req zone=api burst=30 nodelay;
    set $upstream http://catalog-service:3004;
    rewrite ^/api/v1/catalog/(.*)$ /$1 break;
    proxy_pass $upstream;
}
```

What happens step by step:

```
Client sends:    GET /api/v1/catalog/categories
rewrite strips:  /api/v1/catalog/
Nginx forwards:  GET /categories  →  catalog-service:3004
```

**Why `set $upstream` instead of a literal URL in `proxy_pass`?**
When the upstream URL is stored in a variable, combined with `resolver 127.0.0.11`, Nginx resolves the Docker service name per-request (lazy DNS). With a literal URL, Nginx resolves it once at startup and caches it. If the backend container restarts and gets a new IP, the lazy approach automatically picks up the new address.

Full routing table:

| Public URL prefix | Backend service | Internal port |
|---|---|---|
| `/api/v1/auth/` | auth-service | 3001 |
| `/api/v1/users/` | user-service | 3002 |
| `/api/v1/vendors/` | vendor-service | 3003 |
| `/api/v1/catalog/` | catalog-service | 3004 |
| `/api/v1/orders/` | order-service | 3005 |
| `/api/v1/delivery/` | delivery-service | 3006 |
| `/api/v1/admin/` | admin-service | 3007 |
| `/api/v1/notification/` | notification-service | 3008 |
| `/api/v1/payments/` | payment-service | 3009 |
| `/api/v1/ratings/` | rating-service | 3010 |
| `/socket.io/` | websocket-gateway | 3011 |

---

### WebSocket (Socket.IO)

```nginx
location /socket.io/ {
    limit_req zone=ws burst=10 nodelay;
    set $ws_upstream http://websocket-gateway:3011;
    proxy_pass         $ws_upstream;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 86400s;
}
```

WebSocket requires:
- `proxy_http_version 1.1` — WebSocket only works over HTTP/1.1
- `Upgrade` and `Connection: upgrade` headers — tell the backend to switch protocols
- `proxy_read_timeout 86400s` — 24-hour timeout prevents Nginx from closing a connected but idle socket

---

### Security Headers

Applied to every response:

```nginx
add_header X-Frame-Options        "SAMEORIGIN"                      always;
add_header X-Content-Type-Options "nosniff"                         always;
add_header X-XSS-Protection       "1; mode=block"                   always;
add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
```

| Header | What it prevents |
|--------|-----------------|
| `X-Frame-Options: SAMEORIGIN` | Clickjacking — embedding the app in an iframe on another domain |
| `X-Content-Type-Options: nosniff` | MIME-type sniffing — browser executing a JS file served as `text/plain` |
| `X-XSS-Protection: 1; mode=block` | Reflected XSS in older browsers |
| `Referrer-Policy` | Leaking the full URL in the `Referer` header to third parties |

---

### Gzip Compression

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 4;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

All JSON API responses are compressed before sending. Level 4 is a good balance between CPU usage and compression ratio — typically reduces JSON response size by 60–80%.

`gzip_vary on` adds a `Vary: Accept-Encoding` header so CDNs and proxies cache compressed and uncompressed versions separately.

---

### Forwarded Headers

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Without these, every backend service would see `127.0.0.1` as the client IP (the nginx container). With them, services get the real client IP from `X-Real-IP` and know whether the original request was HTTP or HTTPS from `X-Forwarded-Proto`.

---

### Proxy Timeouts

```nginx
proxy_connect_timeout 10s;
proxy_send_timeout    30s;
proxy_read_timeout    30s;
```

| Setting | Meaning |
|---------|---------|
| `proxy_connect_timeout` | Max time to establish a TCP connection to the backend |
| `proxy_send_timeout` | Max time between consecutive writes to the backend |
| `proxy_read_timeout` | Max time waiting for a response from the backend |

If a backend hangs, Nginx closes the connection and returns **504 Gateway Timeout** after 30 seconds.

---

### Health Check Endpoint

```nginx
location /health {
    access_log off;
    return 200 '{"status":"healthy","service":"nginx-gateway"}';
    add_header Content-Type application/json;
}
```

Responds instantly from Nginx itself — no backend involved. Used by `deploy.sh` after startup to verify the gateway is reachable.

---

### Catch-All (404)

```nginx
location / {
    return 404 '{"success":false,"message":"route_not_found"}';
    add_header Content-Type application/json;
}
```

Any request that does not match a defined route gets a JSON 404 — consistent with the API response format used by all services.

---

## SSL Config (`nginx/nginx.ssl.conf`)

Activated by running `./scripts/deploy.sh --ssl`. Contains the same routing rules as the HTTP config plus:

### HTTP → HTTPS Redirect

```nginx
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$host$request_uri;
}
```

All plain HTTP traffic is permanently redirected to HTTPS before anything else.

### HTTPS Server Block

```nginx
server {
    listen 443 ssl;
    http2 on;

    ssl_certificate     /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_stapling        on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}
```

| Setting | Why |
|---------|-----|
| `ssl_protocols TLSv1.2 TLSv1.3` | Drops TLS 1.0/1.1 (insecure, deprecated) |
| `ssl_session_cache shared:SSL:10m` | Caches TLS handshake results — faster reconnects |
| `ssl_session_tickets off` | Disables session tickets (forward secrecy concern) |
| `ssl_stapling on` | Nginx attaches OCSP status to the response — client skips a separate CA request |
| HSTS `max-age=63072000` | Tells browsers to enforce HTTPS for this domain for 2 years |

`DOMAIN_PLACEHOLDER` is a literal string replaced at deploy time by `deploy.sh` with your real domain.

Certificate renewal runs automatically via a cron job added by `deploy.sh`:
```
0 2 * * * certbot renew --quiet && docker compose restart nginx
```

---

## Dashboard nginx (`web/*/nginx.conf`)

Each dashboard image bundles its own minimal nginx config:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**`try_files $uri $uri/ /index.html`** is essential for React Router. Without it, a user refreshing `/orders/123` gets a real 404 from nginx because that file doesn't exist on disk. With it, nginx falls back to `index.html` and React Router handles the URL client-side.

**`Cache-Control: public, immutable`** tells the browser the file at this URL will never change. Since Vite includes a content hash in every asset filename (e.g. `main.a3f92c.js`), this is always safe — a new build produces a new filename, so cached files are never stale.
