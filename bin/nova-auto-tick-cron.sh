#!/usr/bin/env bash
# Nova Auto-Executor — cron-friendly tick wrapper.
#
# Runs: tick (pick next eligible) -> watch (spawn if picked/in_progress) -> drain (mark done if result).
# Emits structured JSON line per state-change so the cron sub-agent can filter + notify.
#
# Designed for */5 cron. Idempotent: safe to run every 5 min.
# Notify is NOT done here (cron sub-agent decides). This wrapper just reports.
#
# Exit codes:
#   0 = run completed (even if no work)
#   1 = error (cron sub-agent will treat as failure)

set -uo pipefail

WORKSPACE="/Users/nova/.openclaw/workspace"
CLI="$WORKSPACE/bin/nova-auto"
STATE_DIR="$HOME/.openclaw/state/auto-executor"
RESULTS_DIR="$STATE_DIR/results"
SPAWN_DIR="$STATE_DIR/spawn-queue"
LOG="$WORKSPACE/logs/auto-executor-cron.log"

mkdir -p "$(dirname "$LOG")" "$RESULTS_DIR" "$SPAWN_DIR"

ts() { date "+%Y-%m-%d %H:%M:%S %z"; }
log() { echo "[$(ts)] $*" | tee -a "$LOG"; }

log "=== nova-auto-tick-cron START ==="

# Snapshot state BEFORE
picks_before=$(jq -r '.count_today // 0' "$STATE_DIR/state.json" 2>/dev/null || echo 0)

# Snapshot backlog done/blocked/partial IDs BEFORE tick/watch/drain so we can
# detect which results are NEW (not already notified in a prior run).
> /tmp/.nova-auto-before-results
jq -r '.items[] | select(.status=="done" or .status=="blocked" or .status=="partial") | .id' \
    "$WORKSPACE/nova-skill-os/backlog.json" 2>/dev/null \
    | sort > /tmp/.nova-auto-before-results

# Step 1: tick (pick next eligible if any)
tick_output=$("$CLI" tick 2>&1)
tick_rc=$?
log "tick rc=$tick_rc"
echo "$tick_output" | tee -a "$LOG"

# Step 2: watch (spawn if picked/in_progress without spawn record)
watch_output=$("$CLI" watch 2>&1)
watch_rc=$?
log "watch rc=$watch_rc"
echo "$watch_output" | tee -a "$LOG"

# Step 3: drain (mark done if result file exists)
drain_output=$("$CLI" drain 2>&1)
drain_rc=$?
log "drain rc=$drain_rc"
echo "$drain_output" | tee -a "$LOG"

# Snapshot state AFTER
picks_after=$(jq -r '.count_today // 0' "$STATE_DIR/state.json" 2>/dev/null || echo 0)

# Report state changes as JSON lines for the cron sub-agent
# Use BEFORE/AFTER state diff: snapshot all done/blocked/partial IDs BEFORE
# running tick/watch/drain, then only emit IDs that are NEW (not in before).
# This avoids stale notifications (re-emitting same items every 5 minutes).

new_results=()
for f in "$RESULTS_DIR"/*.md; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .md)
    # Check backlog: only emit if item is now done/blocked/partial AND was not in that state BEFORE wrapper ran
    item_status_now=$(jq -r --arg id "$id" '.items[] | select(.id==$id) | .status' "$WORKSPACE/nova-skill-os/backlog.json" 2>/dev/null || echo "missing")
    if [[ "$item_status_now" != "done" && "$item_status_now" != "blocked" && "$item_status_now" != "partial" ]]; then
        continue
    fi
    # Skip if id was already in before-results (already notified in a prior run)
    if grep -qx "$id" /tmp/.nova-auto-before-results 2>/dev/null; then
        continue
    fi
    # Item is NEW done/blocked/partial since wrapper started
    status=$(awk '/^## Status/{getline; print; exit}' "$f" | tr -d '\r\n[:space:]' | tr '[:upper:]' '[:lower:]')
    if [ -z "$status" ]; then
        status=$(grep -i "^status:" "$f" | head -1 | awk '{print $2}' | tr '[:upper:]' '[:lower:]')
    fi
    title=$(jq -r --arg id "$id" '.items[] | select(.id==$id) | .title' "$WORKSPACE/nova-skill-os/backlog.json" 2>/dev/null || echo "$id")
    evidence=$(awk '/^## Summary/{flag=1; next} /^## /{flag=0} flag' "$f" | head -c 280 | tr -d '\n\r' | sed 's/  */ /g')
    echo "{\"kind\":\"result\",\"id\":\"$id\",\"status\":\"${status:-unknown}\",\"title\":\"$title\",\"evidence\":\"$evidence\"}"
done > /tmp/nova-auto-cron-results.json 2>/dev/null

# If envelope is empty (no new results), ensure file exists but is empty
[ ! -f /tmp/nova-auto-cron-results.json ] && > /tmp/nova-auto-cron-results.json

new_picks=$((picks_after - picks_before))
if [ "$new_picks" -gt 0 ]; then
    echo "{\"kind\":\"pick\",\"delta\":$new_picks,\"picks_today\":$picks_after}" >> /tmp/nova-auto-cron-results.json
fi

rm -f /tmp/.nova-auto-before-results 2>/dev/null

log "=== nova-auto-tick-cron END (picks=$picks_after) ==="

# Always exit 0 unless one of the three subcommands hard-failed.
# (auto-executor returns 0 even when no work happens.)
if [ "$tick_rc" -ne 0 ] && [ "$watch_rc" -ne 0 ] && [ "$drain_rc" -ne 0 ]; then
    exit 1
fi
exit 0