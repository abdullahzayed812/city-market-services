# Scripts — CityMarket

This document explains the shell scripts in `scripts/`: what they do, how to use them, and how they behave internally.

---

## `scripts/deploy.sh`

The production deployment script. Handles first-time setup, SSL provisioning, and rolling updates.

```bash
./scripts/deploy.sh           # First-time deploy (HTTP)
./scripts/deploy.sh --ssl     # Enable HTTPS with Let's Encrypt
./scripts/deploy.sh --update  # Pull latest code + rebuild changed images + restart
```

### What it does step by step

**1. Checks prerequisites**
Verifies that `docker` and `git` are installed on the host. Prints the Docker version and exits with a clear error if either is missing.

**2. Checks `.env`**
- If `.env` does not exist, copies `.env.example` and exits with instructions to fill in real values.
- If `.env` exists but still contains placeholder values (`change_me`), warns the operator and asks for confirmation before continuing.

**3. SSL setup** (`--ssl` only)
- Stops the nginx container to free port 80 for the certbot challenge.
- Runs `certbot certonly --standalone` to obtain Let's Encrypt certificates for `$DOMAIN` and `www.$DOMAIN`.
- Replaces the literal string `DOMAIN_PLACEHOLDER` in `nginx/nginx.ssl.conf` with the real domain and writes the result to `nginx/nginx.active.conf`.
- Adds a cron job for automatic certificate renewal:
  ```
  0 2 * * * certbot renew --quiet && docker compose restart nginx
  ```

**4. Builds images**
- `--update` mode: runs `git pull` first, then `docker compose build --pull` — Docker only rebuilds images whose layers changed.
- First-time mode: `docker compose build --pull` — builds everything from scratch.

**5. Starts infrastructure first**
Brings up `mysql`, `redis`, and `rabbitmq`, then polls until all three healthchecks pass before moving on. This guarantees services never boot against an unready database.

**6. Starts all services**
Runs `docker compose up -d` to bring up the full stack.

**7. Activates SSL config** (`--ssl` only)
Copies `nginx/nginx.active.conf` into the running nginx container with `docker cp` and reloads nginx in-place with `nginx -s reload` — no downtime.

**8. Health checks**
Waits 30 seconds for services to stabilize, then sends a request to each service's `/health` endpoint through the gateway and prints `[OK]` or `[FAIL]`:

```
[OK]  Nginx gateway
[OK]  Auth service
[OK]  Catalog service
...
```

If any service fails, it prints instructions to check logs:
```bash
docker compose logs --tail=50 <service-name>
```

**9. Adds backup cron**
If the backup cron job is not already registered, adds it:
```
0 3 * * * /opt/citymarket/scripts/backup-mysql.sh >> /var/log/citymarket-backup.log 2>&1
```

---

## `scripts/backup-mysql.sh`

Backs up all 10 service databases to compressed `.sql.gz` files and optionally uploads them to cloud storage.

```bash
./scripts/backup-mysql.sh                               # local backup only
RCLONE_REMOTE=r2:my-bucket ./scripts/backup-mysql.sh   # backup + upload to S3/R2
```

### What it does step by step

**1. Loads `.env`**
Sources the project root `.env` file so it picks up `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, etc. without needing them passed as arguments.

**2. Dumps each database**
Loops over all 10 databases and runs `mysqldump` piped directly into `gzip`:

```bash
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  <db_name> | gzip -9 > <db_name>_YYYYMMDD_HHMMSS.sql.gz
```

`--single-transaction` takes a consistent point-in-time snapshot of InnoDB tables without acquiring any locks — safe to run against a live production database with no impact on running queries.

Databases backed up:
```
auth_db  user_db  vendor_db  catalog_db  order_db
delivery_db  admin_db  notification_db  payment_db  rating_db
```

**3. Cleans up old backups**
Deletes any `.sql.gz` files in `BACKUP_DIR` older than `KEEP_DAYS` days:
```bash
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
```

**4. Uploads to cloud storage** (optional)
If `RCLONE_REMOTE` is set and `rclone` is installed, uploads only the files created in this run:
```bash
rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*_${TIMESTAMP}.sql.gz"
```

### Configuration

All options are set via environment variables — either in `.env` or inline when calling the script:

| Variable | Default | Purpose |
|---|---|---|
| `BACKUP_DIR` | `/var/backups/citymarket/mysql` | Directory where `.sql.gz` files are written |
| `KEEP_DAYS` | `7` | Number of days of backups to keep locally |
| `RCLONE_REMOTE` | _(empty — disables upload)_ | `rclone` remote path, e.g. `r2:my-bucket/citymarket/mysql` |
| `DB_HOST` | `127.0.0.1` | MySQL hostname — use `127.0.0.1` from the host, `mysql` from inside Docker |
| `DB_PORT` | `3307` | MySQL port — 3307 is the host-side port mapped by docker-compose |
| `DB_USER` | `citymarket` | MySQL user |
| `DB_PASSWORD` | _(required)_ | MySQL password — loaded from `.env` |

### Cron schedule

Added automatically by `deploy.sh` if not already present:
```
0 3 * * * /opt/citymarket/scripts/backup-mysql.sh >> /var/log/citymarket-backup.log 2>&1
```

Runs at 3 AM daily. All output (including errors) is appended to the log file for later review.

To restore a backup:
```bash
gunzip -c auth_db_20260502_030000.sql.gz | mysql -h 127.0.0.1 -P 3307 -u citymarket -p auth_db
```
