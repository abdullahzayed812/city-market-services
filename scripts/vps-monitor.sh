#!/bin/bash
# VPS resource monitor — runs via cron, emails alerts when thresholds are crossed.
# Setup: chmod +x scripts/vps-monitor.sh && crontab -e
#   Add: */5 * * * * /home/abdullah/dev/citymarket/scripts/vps-monitor.sh

# ── Configuration ──────────────────────────────────────────────────────────────
ALERT_EMAIL="zuhairalrawi0@gmail.com"

CPU_THRESHOLD=85      # alert when CPU usage >= this percent
RAM_THRESHOLD=85      # alert when RAM usage >= this percent
DISK_THRESHOLD=85     # alert when any partition >= this percent
SWAP_THRESHOLD=60     # alert when swap usage >= this percent

COOLDOWN=1800         # seconds before re-alerting for the same metric (30 min)
STATE_DIR="/tmp/vps-monitor"
# ───────────────────────────────────────────────────────────────────────────────

mkdir -p "$STATE_DIR"
HOSTNAME=$(hostname)
ALERTS=()

# Returns 0 (ok to alert) only if outside the cooldown window for a given key.
can_alert() {
    local key="$1" now state_file last
    now=$(date +%s)
    state_file="$STATE_DIR/$key"
    if [[ -f "$state_file" ]]; then
        last=$(cat "$state_file")
        (( now - last < COOLDOWN )) && return 1
    fi
    echo "$now" > "$state_file"
    return 0
}

# ── CPU (1-second sample from /proc/stat) ──────────────────────────────────────
cpu_percent() {
    local -a s1 s2
    read -ra s1 < <(grep '^cpu ' /proc/stat); sleep 1
    read -ra s2 < <(grep '^cpu ' /proc/stat)
    local total1=$(( s1[1]+s1[2]+s1[3]+s1[4]+s1[5]+s1[6]+s1[7] ))
    local total2=$(( s2[1]+s2[2]+s2[3]+s2[4]+s2[5]+s2[6]+s2[7] ))
    local dtotal=$(( total2 - total1 ))
    local didle=$(( s2[4] - s1[4] ))
    (( dtotal == 0 )) && echo 0 || echo $(( 100 * (dtotal - didle) / dtotal ))
}

CPU=$(cpu_percent)
if (( CPU >= CPU_THRESHOLD )) && can_alert "cpu"; then
    ALERTS+=("CPU usage:  ${CPU}%  (threshold: ${CPU_THRESHOLD}%)")
fi

# ── RAM ────────────────────────────────────────────────────────────────────────
read -r MEM_TOTAL MEM_USED _ MEM_AVAIL < <(free -m | awk '/^Mem:/{print $2,$3,$4,$7}')
MEM_PCT=$(( 100 * (MEM_TOTAL - MEM_AVAIL) / MEM_TOTAL ))

if (( MEM_PCT >= RAM_THRESHOLD )) && can_alert "ram"; then
    ALERTS+=("RAM usage:  ${MEM_PCT}%  (${MEM_USED} MB used / ${MEM_TOTAL} MB total, ${MEM_AVAIL} MB available)  (threshold: ${RAM_THRESHOLD}%)")
fi

# ── Swap ───────────────────────────────────────────────────────────────────────
read -r SWAP_TOTAL SWAP_USED < <(free -m | awk '/^Swap:/{print $2,$3}')
if (( SWAP_TOTAL > 0 )); then
    SWAP_PCT=$(( 100 * SWAP_USED / SWAP_TOTAL ))
    if (( SWAP_PCT >= SWAP_THRESHOLD )) && can_alert "swap"; then
        ALERTS+=("Swap usage: ${SWAP_PCT}%  (${SWAP_USED} MB used / ${SWAP_TOTAL} MB total)  (threshold: ${SWAP_THRESHOLD}%)")
    fi
fi

# ── Disk (skips tmpfs, devtmpfs, udev) ────────────────────────────────────────
while IFS= read -r line; do
    PCT=$(echo "$line" | awk '{gsub(/%/,"",$5); print $5}')
    MOUNT=$(echo "$line" | awk '{print $6}')
    if (( PCT >= DISK_THRESHOLD )); then
        KEY="disk_$(echo "$MOUNT" | tr '/' '_' | tr -cd '[:alnum:]_')"
        can_alert "$KEY" && ALERTS+=("Disk ${MOUNT}: ${PCT}%  (threshold: ${DISK_THRESHOLD}%)")
    fi
done < <(df -h | awk 'NR>1 && $1 !~ /^(tmpfs|devtmpfs|udev)/')

# ── Nothing to report ─────────────────────────────────────────────────────────
(( ${#ALERTS[@]} == 0 )) && exit 0

# ── Build and send email ───────────────────────────────────────────────────────
SUBJECT="[VPS ALERT] $HOSTNAME — resource threshold exceeded"

BODY="VPS Monitor — $HOSTNAME
Time  : $(date)
Uptime: $(uptime -p)

The following thresholds have been exceeded:
"
for alert in "${ALERTS[@]}"; do
    BODY+="  • $alert"$'\n'
done

BODY+="
── System Snapshot ──────────────────────────────────────────
$(uptime)

$(free -h)

$(df -h | awk 'NR==1 || ($1 !~ /^(tmpfs|devtmpfs|udev)/)')
"

echo "$BODY" | mail -s "$SUBJECT" "$ALERT_EMAIL"
