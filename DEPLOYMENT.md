# CityMarket — Production Deployment Guide

## Architecture Overview

```
                    Internet
                       │
                    Nginx :80/:443
                       │
          ┌────────────┼────────────┐
          │            │            │
       REST API     Socket.IO    Static Dashboards
          │                      (8080/8082/8083)
    ┌─────┴──────┐
    │  11 Node.js│
    │  Services  │
    └─────┬──────┘
          │
    ┌─────┼─────┐
   MySQL Redis RabbitMQ
```

**Services**: auth · user · vendor · catalog · order · delivery · admin · notification · payment · rating · websocket-gateway

**Ports exposed to host**: 80 (nginx), 443 (nginx SSL), 8080/8082/8083 (dashboards), 3307 (MySQL), 6380 (Redis), 5673/15673 (RabbitMQ)

---

## 1. Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU      | 2 cores | 4 cores     |
| RAM      | 4 GB    | 8 GB        |
| Disk     | 40 GB   | 80 GB SSD   |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

---

## 2. Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 3. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-org/citymarket.git /opt/citymarket
cd /opt/citymarket

# Copy environment template
cp .env.example .env
```

Edit `.env` — replace every `change_me_*` value:

```bash
nano .env
```

**Required secrets to generate:**

```bash
# Generate strong secrets (run once each)
openssl rand -hex 64   # → JWT_ACCESS_SECRET
openssl rand -hex 64   # → JWT_REFRESH_SECRET
openssl rand -hex 64   # → JWT_SERVICE_ACCESS_SECRET
openssl rand -hex 32   # → DB_PASSWORD
openssl rand -hex 32   # → MYSQL_ROOT_PASSWORD
openssl rand -hex 32   # → REDIS_PASSWORD
openssl rand -hex 32   # → RABBITMQ_PASSWORD
openssl rand -hex 32   # → (each SERVICE_CLIENT_SECRET)
```

**Firebase push notifications (optional):**

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key and download `firebase-credentials.json`
3. Place it in the project root: `cp ~/firebase-credentials.json /opt/citymarket/`
4. Set in `.env`:
   ```
   FIREBASE_CREDENTIALS_FILE=./firebase-credentials.json
   ```

---

## 4. First Deploy (HTTP only)

```bash
cd /opt/citymarket
./scripts/deploy.sh
```

This will:
1. Build all Docker images
2. Start MySQL, Redis, RabbitMQ
3. Start all 11 microservices
4. Start Nginx (port 80)
5. Start 3 web dashboards
6. Add a daily backup cron (3 AM)

Verify everything is running:

```bash
docker compose ps
curl http://localhost/health
```

---

## 5. Set Up a Domain

Point your domain DNS `A` record to the VPS IP:

```
A    @              → YOUR_VPS_IP
A    www            → YOUR_VPS_IP
```

Wait for DNS propagation (1–5 minutes with most providers).

Update `.env`:

```
DOMAIN=yourdomain.com
VITE_API_URL=https://yourdomain.com/api/v1
VITE_API_BASE_URL=https://yourdomain.com/api/v1
VITE_WEBSOCKET_URL=https://yourdomain.com
```

---

## 6. Enable SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt-get update && sudo apt-get install -y certbot

# Run deploy with SSL flag
./scripts/deploy.sh --ssl
```

This obtains a certificate, switches the nginx config to the SSL version, and adds automatic renewal via cron.

**Manual SSL switch** (if you already have a cert):

```bash
# Replace DOMAIN_PLACEHOLDER with your actual domain
sed "s/DOMAIN_PLACEHOLDER/yourdomain.com/g" nginx/nginx.ssl.conf > nginx/nginx.active.conf

# Copy into the running nginx container
docker cp nginx/nginx.active.conf $(docker compose ps -q nginx):/etc/nginx/conf.d/default.conf
docker compose exec nginx nginx -s reload
```

Expose port 443 in docker-compose.yml for the nginx service:

```yaml
ports:
  - "80:80"
  - "443:443"
```

And mount the certificate directory:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
  - /var/www/certbot:/var/www/certbot:ro
```

---

## 7. Updating the Application

```bash
cd /opt/citymarket
git pull
./scripts/deploy.sh --update
```

This rebuilds changed images and restarts services with zero manual steps.

---

## 8. Monitoring Logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f order-service

# Last 100 lines
docker compose logs --tail=100 auth-service
```

---

## 9. Database Backups

Backups run automatically at 3 AM via cron (added by deploy.sh).

**Manual backup:**

```bash
./scripts/backup-mysql.sh
# Files saved to: /var/backups/citymarket/mysql/
```

**Upload to Cloudflare R2:**

1. Install rclone: `curl https://rclone.org/install.sh | sudo bash`
2. Configure: `rclone config` → create remote named `r2`
3. Set in `.env`: `RCLONE_REMOTE=r2:your-bucket/citymarket`
4. Run: `./scripts/backup-mysql.sh`

---

## 10. Accessing Dashboards

| Dashboard | URL |
|-----------|-----|
| Admin     | http://YOUR_IP:8080 |
| Vendor    | http://YOUR_IP:8083 |
| Delivery  | http://YOUR_IP:8082 |
| RabbitMQ UI | http://YOUR_IP:15673 |

> In production, close ports 8080/8082/8083/15673 to the public via firewall and access via SSH tunnel:
> ```bash
> ssh -L 8080:localhost:8080 -L 15673:localhost:15673 user@YOUR_VPS_IP
> ```

---

## 11. Firewall (UFW)

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Block direct service ports from public
sudo ufw deny 3307/tcp   # MySQL
sudo ufw deny 6380/tcp   # Redis
sudo ufw deny 5673/tcp   # RabbitMQ
sudo ufw deny 15673/tcp  # RabbitMQ UI
```

---

## 12. Common Troubleshooting

| Issue | Command |
|-------|---------|
| Service not starting | `docker compose logs <service>` |
| DB connection refused | `docker compose exec mysql mysqladmin ping -uroot -p$MYSQL_ROOT_PASSWORD` |
| RabbitMQ not ready | `docker compose exec rabbitmq rabbitmq-diagnostics ping` |
| Nginx 502 | Check if upstream service is running: `docker compose ps` |
| Out of disk | `docker system prune -f` (removes unused images/containers) |
| Restart single service | `docker compose restart <service>` |
| Full restart | `docker compose down && docker compose up -d` |
