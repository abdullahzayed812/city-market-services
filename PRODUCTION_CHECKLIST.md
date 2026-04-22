# CityMarket — Production Readiness Checklist

Run through this list before going live.

---

## Security

- [ ] All `change_me_*` values replaced in `.env`
- [ ] JWT secrets are 64-byte random hex strings (`openssl rand -hex 64`)
- [ ] All service client secrets are unique and random (`openssl rand -hex 32`)
- [ ] `RABBITMQ_USER` / `RABBITMQ_PASSWORD` are not `guest/guest`
- [ ] `REDIS_PASSWORD` is set
- [ ] `MYSQL_ROOT_PASSWORD` and `DB_PASSWORD` are strong and different
- [ ] Firewall blocks ports 3307, 5673, 6380, 15673 from the public internet
- [ ] SSL certificate installed and HTTP → HTTPS redirect works
- [ ] Firebase credentials file is NOT committed to git (check `.gitignore`)
- [ ] `.env` is NOT committed to git

---

## Infrastructure

- [ ] `docker compose ps` — all services show `Up` (not `Restarting`)
- [ ] MySQL health: `docker compose exec mysql mysqladmin ping -uroot -p$MYSQL_ROOT_PASSWORD`
- [ ] Redis health: `docker compose exec redis redis-cli -a $REDIS_PASSWORD ping` → `PONG`
- [ ] RabbitMQ health: `docker compose exec rabbitmq rabbitmq-diagnostics ping`
- [ ] All 10 databases exist: `docker compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD -e "SHOW DATABASES;"`
- [ ] All databases grant `citymarket` user access (run above and check list)

---

## Services

- [ ] `curl http://localhost/health` → `{"status":"healthy","service":"nginx-gateway"}`
- [ ] Auth service responds: `curl http://localhost/api/v1/auth/health`
- [ ] User service responds: `curl http://localhost/api/v1/users/health`
- [ ] Vendor service responds: `curl http://localhost/api/v1/vendors/health`
- [ ] Catalog service responds: `curl http://localhost/api/v1/catalog/health`
- [ ] Order service responds: `curl http://localhost/api/v1/orders/health`
- [ ] Delivery service responds: `curl http://localhost/api/v1/delivery/health`
- [ ] Admin service responds: `curl http://localhost/api/v1/admin/health`
- [ ] Notification service responds: `curl http://localhost/api/v1/notification/health`
- [ ] Payment service responds: `curl http://localhost/api/v1/payments/health`
- [ ] Rating service responds: `curl http://localhost/api/v1/ratings/health`
- [ ] WebSocket connects: open browser dev tools → `new WebSocket('wss://yourdomain.com/socket.io/?EIO=4&transport=websocket')` — no error

---

## Features

- [ ] User can register and receive JWT token
- [ ] Vendor can log in and create a product
- [ ] Customer can place an order
- [ ] Order triggers RabbitMQ event (check notification-service logs)
- [ ] Push notification fires (check notification-service logs for Firebase response)
- [ ] Delivery manager can see new orders in delivery dashboard
- [ ] WebSocket broadcasts order status update to connected clients
- [ ] Admin dashboard loads and shows data

---

## Observability

- [ ] `docker compose logs --tail=50 order-service` — no ERROR lines at startup
- [ ] `docker compose logs --tail=50 notification-service` — Firebase initialized (or gracefully skipped)
- [ ] RabbitMQ management UI shows expected queues: http://localhost:15673
- [ ] Log rotation is active: `docker inspect $(docker compose ps -q auth-service) | grep -A5 LogConfig`

---

## Backups

- [ ] Manual backup runs: `./scripts/backup-mysql.sh`
- [ ] Backup files appear in `/var/backups/citymarket/mysql/`
- [ ] Cron is set: `crontab -l | grep backup`
- [ ] (Optional) Cloud upload works: set `RCLONE_REMOTE` and re-run backup script

---

## Domains & SSL

- [ ] Domain A record points to VPS IP
- [ ] `curl -I https://yourdomain.com/health` → HTTP 200
- [ ] `curl -I http://yourdomain.com` → HTTP 301 redirect to HTTPS
- [ ] SSL certificate is valid: `echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates`
- [ ] Certbot auto-renewal cron is active: `crontab -l | grep certbot`

---

## Post-Launch

- [ ] Seed initial admin user
- [ ] Seed global product catalog (if applicable)
- [ ] Test a full order flow end-to-end with real devices
- [ ] Monitor logs for the first 30 minutes after launch
- [ ] Set up uptime monitoring (UptimeRobot, Betterstack, etc.) on `/health`
