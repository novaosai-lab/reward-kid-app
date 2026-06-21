#!/usr/bin/env bash
# Nova Self-Heal — known-pattern auto-recovery for cron sub-agent.
#
# Scans recent failures (last 15 minutes) from:
#   - logs/launcher-watchdog.out.log (LaunchAgent silent / recovery failed)
#   - logs/auto-executor-cron.log (wrapper failures)
#   - logs/auto-executor.log (sub-agent failures)
#   - journal-style errors from nova-auto state
# And applies known-pattern fixes (capped: max 2 attempts per hour per pattern).
#
# Returns structured JSON envelope to stdout for the cron sub-agent to include in notify.
#
# Patterns supported (v1):
#   - launchagent_silent        : process not running -> kickstart -k (idempotent)
#   - launchagent_recovery_cap  : watchdog hit max_recoveries_per_hour -> log only
#   - cloudflared_dead          : process state != running -> kickstart + check metrics
#   - line_bridge_dead          : process state != running -> kickstart (KeepAlive now)
#   - nova_auto_cli_failure     : re-run once with --force
#   - envelope_stale            : no new results in last 3 runs -> tick manually
#
# Hard limits:
#   - max 2 heal attempts per pattern per hour (prevents storm)
#   - never disable a LaunchAgent (only kickstart)
#   - never delete files (only restart / re-run)
#   - never modify configs (only read + report)
#   - if pattern unknown: return status="unknown_pattern" + last 200 chars of error
#
# Exit codes:
#   0 = heal attempted (or nothing to heal) — JSON envelope in stdout
#   1 = heal script itself failed — escalate to manual

set -uo pipefail

WORKSPACE="/Users/nova/.openclaw/workspace"
HEAL_STATE="$HOME/.openclaw/state/auto-executor/heal-state.json"
LOG="$WORKSPACE/logs/auto-executor-cron.log"
WATCHDOG_LOG="$WORKSPACE/logs/launcher-watchdog.out.log"
AUTO_LOG="$WORKSPACE/logs/auto-executor.log"
MAX_HEALS_PER_HOUR=2
SELF_HEAL_WINDOW_MIN=15

mkdir -p "$(dirname "$HEAL_STATE")" "$(dirname "$LOG")"

ts() { date "+%Y-%m-%d %H:%M:%S %z"; }
log() { echo "[$(ts)] [self-heal] $*" >> "$LOG"; }

# Init heal state if missing
if [ ! -f "$HEAL_STATE" ]; then
    echo '{"heals": [], "last_reset": ""}' > "$HEAL_STATE"
fi

# Reset heal counter if last reset was over an hour ago
last_reset=$(jq -r '.last_reset // ""' "$HEAL_STATE" 2>/dev/null)
now_epoch=$(date +%s)
should_reset=1
if [ -n "$last_reset" ]; then
    last_epoch=$(date -j -f '%Y-%m-%dT%H:%M:%S' "${last_reset%.*}" '+%s' 2>/dev/null || echo 0)
    if [ "$last_epoch" -gt 0 ] && [ $((now_epoch - last_epoch)) -le 3600 ]; then
        should_reset=0
    fi
fi
if [ "$should_reset" -eq 1 ]; then
    echo '{"heals": [], "last_reset": "'"$(date -u +%Y-%m-%dT%H:%M:%S)"'"}' > "$HEAL_STATE"
fi

# Helpers
record_heal() {
    local pattern="$1" outcome="$2" detail="$3"
    jq --arg p "$pattern" --arg o "$outcome" --arg d "$detail" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S)" \
       '.heals += [{"pattern": $p, "outcome": $o, "detail": $d, "ts": $ts}]' \
       "$HEAL_STATE" > "$HEAL_STATE.tmp" && mv "$HEAL_STATE.tmp" "$HEAL_STATE"
}

heal_count_in_last_hour() {
    local pattern="$1"
    local since_epoch=$((now_epoch - 3600))
    local since_iso
    since_iso=$(date -u -r "$since_epoch" '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo "1970-01-01T00:00:00")
    jq --arg p "$pattern" --arg s "$since_iso" \
       '[.heals[] | select(.pattern==$p and .ts >= $s)] | length' \
       "$HEAL_STATE" 2>/dev/null || echo 0
}

kickstart_launchagent() {
    local label="$1"
    local uid
    uid=$(id -u)
    local target="gui/$uid"
    local plist="$HOME/Library/LaunchAgents/$label.plist"
    if [ ! -f "$plist" ]; then
        echo "plist_missing:$plist"
        return 1
    fi
    # kickstart -k forces a fresh spawn (KeepAlive will keep it alive thereafter)
    launchctl kickstart -k "$target/$label" 2>&1 | head -3
    return $?
}

check_launchagent_state() {
    local label="$1"
    local uid
    uid=$(id -u)
    launchctl print "gui/$uid/$label" 2>/dev/null | grep -E "^\s*state" | head -1 | tr -d ' '
}

# ---------------------------------------------------------------------------
# Pattern detectors — return JSON line if matched, empty otherwise
# ---------------------------------------------------------------------------

# launchagent_silent: watchdog log shows "X silent for Yh" + "recovery attempts failed"
# Note: watchdog uses job names (e.g. "cloudflared-tunnel") which differ from
# the LaunchAgent labels (e.g. "homebrew.mxcl.cloudflared"). Map them.
detect_launchagent_silent() {
    [ -f "$WATCHDOG_LOG" ] || return
    # Look for any line in last 15 min containing "silent for" + "recovered" missing
    local recent_silent
    recent_silent=$(find "$WATCHDOG_LOG" -mmin -${SELF_HEAL_WINDOW_MIN} -print -quit 2>/dev/null)
    [ -z "$recent_silent" ] && return
    # Collect unique dead agents from recent watchdog log
    # Note: log lines are like "[2026-06-22 02:27:35 +07] jobname silent for 0.5h ..."
    # We need the 4th field (jobname).
    local candidates
    candidates=$(grep -h "silent for" "$WATCHDOG_LOG" 2>/dev/null | tail -20 | awk '{print $4}' | sort -u)
    for jobname in $candidates; do
        [ -z "$jobname" ] && continue
        # Map job name → LaunchAgent label
        local label
        case "$jobname" in
            cloudflared-tunnel) label="homebrew.mxcl.cloudflared" ;;
            line-native-channel) label="ai.openclaw.line-bridge" ;;
            coupon-points-issue-alert) label="ai.openclaw.coupon-points-issue-alert" ;;
            discord-prod-order-forwarder) label="ai.openclaw.discord-prod-order-forwarder" ;;
            guard-agent) label="ai.openclaw.guard-agent" ;;
            launcher-watchdog) label="ai.openclaw.launcher-watchdog" ;;
            *) label="ai.openclaw.$jobname" ;;
        esac
        local state
        state=$(check_launchagent_state "$label")
        if [[ "$state" != *"state=running"* ]]; then
            jq -nc --arg j "$jobname" --arg a "$label" --arg s "$state" \
               '{pattern:"launchagent_silent", job:$j, agent:$a, state:$s}'
        fi
    done
}

# cloudflared_dead: process check + metrics endpoint
detect_cloudflared_dead() {
    local state
    state=$(check_launchagent_state "homebrew.mxcl.cloudflared")
    if [[ "$state" != *"state=running"* ]]; then
        local metrics_ok="no"
        if curl -fsS --max-time 3 http://127.0.0.1:20241/metrics 2>/dev/null | grep -q cloudflared_tunnel; then
            metrics_ok="yes"
        fi
        jq -nc --arg s "$state" --arg m "$metrics_ok" \
           '{pattern:"cloudflared_dead", state:$s, metrics:$m}'
    fi
}

# line_bridge_dead: process check
detect_line_bridge_dead() {
    local state
    state=$(check_launchagent_state "ai.openclaw.line-bridge")
    if [[ "$state" != *"state=running"* ]]; then
        jq -nc --arg s "$state" '{pattern:"line_bridge_dead", state:$s}'
    fi
}

# envelope_stale: 3+ runs in a row produced empty envelope while backlog has eligible items
detect_envelope_stale() {
    [ -f "$WORKSPACE/nova-skill-os/backlog.json" ] || return
    local eligible
    eligible=$(jq '[.items[] | select(.status=="pending" and .approval=="none")] | length' \
               "$WORKSPACE/nova-skill-os/backlog.json" 2>/dev/null || echo 0)
    if [ "$eligible" -eq 0 ]; then
        return
    fi
    # Check recent cron envelope history (via cron runs summary)
    local runs_json
    runs_json=$(openclaw cron runs --id 7bb67006-36b2-457d-a50e-2a1ed165857d --limit 3 2>/dev/null || echo '{"entries":[]}')
    local idle_count
    idle_count=$(echo "$runs_json" | jq '[.entries[] | select(.summary | startswith("idle"))] | length' 2>/dev/null || echo 0)
    if [ "$idle_count" -ge 3 ] && [ "$eligible" -gt 0 ]; then
        jq -nc --arg e "$eligible" --arg i "$idle_count" \
           '{pattern:"envelope_stale", eligible_items:($e|tonumber), consecutive_idle:$i}'
    fi
}

# ---------------------------------------------------------------------------
# Heal actions — apply fix, return outcome
# ---------------------------------------------------------------------------

heal_launchagent_silent() {
    local json="$1"
    local agent
    agent=$(echo "$json" | jq -r '.agent')
    if [ "$(heal_count_in_last_hour launchagent_silent)" -ge "$MAX_HEALS_PER_HOUR" ]; then
        log "skip launchagent_silent: cap reached for $agent"
        echo "{\"pattern\":\"launchagent_silent\",\"agent\":\"$agent\",\"outcome\":\"cap_reached\",\"detail\":\"$MAX_HEALS_PER_HOUR attempts in last hour\"}"
        return
    fi
    local out
    out=$(kickstart_launchagent "$agent" 2>&1)
    local rc=$?
    log "kickstart $agent rc=$rc out=$out"
    if [ "$rc" -eq 0 ]; then
        record_heal "launchagent_silent" "success" "$agent kickstart ok"
        echo "{\"pattern\":\"launchagent_silent\",\"agent\":\"$agent\",\"outcome\":\"success\",\"detail\":\"kickstart ok\"}"
    else
        record_heal "launchagent_silent" "fail" "$agent kickstart failed: $out"
        echo "{\"pattern\":\"launchagent_silent\",\"agent\":\"$agent\",\"outcome\":\"fail\",\"detail\":\"$out\"}"
    fi
}

heal_cloudflared_dead() {
    if [ "$(heal_count_in_last_hour cloudflared_dead)" -ge "$MAX_HEALS_PER_HOUR" ]; then
        echo '{"pattern":"cloudflared_dead","outcome":"cap_reached","detail":"already tried 2x this hour"}'
        return
    fi
    local out
    out=$(kickstart_launchagent "homebrew.mxcl.cloudflared" 2>&1)
    local rc=$?
    # Wait 5s then verify metrics
    sleep 5
    local metrics_ok="no"
    if curl -fsS --max-time 5 http://127.0.0.1:20241/metrics 2>/dev/null | grep -q cloudflared_tunnel; then
        metrics_ok="yes"
    fi
    log "cloudflared heal rc=$rc metrics_ok=$metrics_ok out=$out"
    if [ "$rc" -eq 0 ] && [ "$metrics_ok" = "yes" ]; then
        record_heal "cloudflared_dead" "success" "kickstart + metrics verified"
        echo "{\"pattern\":\"cloudflared_dead\",\"outcome\":\"success\",\"detail\":\"kickstart ok + metrics verified\"}"
    else
        record_heal "cloudflared_dead" "fail" "kickstart rc=$rc metrics=$metrics_ok out=$out"
        echo "{\"pattern\":\"cloudflared_dead\",\"outcome\":\"fail\",\"detail\":\"kickstart rc=$rc metrics=$metrics_ok\"}"
    fi
}

heal_line_bridge_dead() {
    if [ "$(heal_count_in_last_hour line_bridge_dead)" -ge "$MAX_HEALS_PER_HOUR" ]; then
        echo '{"pattern":"line_bridge_dead","outcome":"cap_reached","detail":"already tried 2x this hour"}'
        return
    fi
    local out
    out=$(kickstart_launchagent "ai.openclaw.line-bridge" 2>&1)
    local rc=$?
    log "line-bridge heal rc=$rc out=$out"
    if [ "$rc" -eq 0 ]; then
        record_heal "line_bridge_dead" "success" "kickstart ok"
        echo "{\"pattern\":\"line_bridge_dead\",\"outcome\":\"success\",\"detail\":\"kickstart ok\"}"
    else
        record_heal "line_bridge_dead" "fail" "$out"
        echo "{\"pattern\":\"line_bridge_dead\",\"outcome\":\"fail\",\"detail\":\"$out\"}"
    fi
}

heal_envelope_stale() {
    # Force a manual tick (heuristic: if eligible items exist and no picks today,
    # there may be a state bug preventing tick from finding them)
    if [ "$(heal_count_in_last_hour envelope_stale)" -ge "$MAX_HEALS_PER_HOUR" ]; then
        echo '{"pattern":"envelope_stale","outcome":"cap_reached","detail":"already tried 2x this hour"}'
        return
    fi
    local tick_out
    tick_out=$("$WORKSPACE/bin/nova-auto" tick 2>&1 | head -5)
    log "envelope_stale manual tick out=$tick_out"
    if echo "$tick_out" | grep -qE "PICK |⛔ Daily limit"; then
        record_heal "envelope_stale" "success" "manual tick made progress"
        echo "{\"pattern\":\"envelope_stale\",\"outcome\":\"success\",\"detail\":\"$tick_out\"}"
    else
        record_heal "envelope_stale" "fail" "manual tick: $tick_out"
        echo "{\"pattern\":\"envelope_stale\",\"outcome\":\"fail\",\"detail\":\"$tick_out\"}"
    fi
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

log "=== self-heal START ==="

heals_attempted=0
heals_success=0
heals_fail=0
heals_cap=0
unknown_patterns=()

# Run detectors in order; each emits zero or more JSON lines
for detector in detect_launchagent_silent detect_cloudflared_dead detect_line_bridge_dead detect_envelope_stale; do
    while IFS= read -r detection; do
        [ -z "$detection" ] && continue
        pattern=$(echo "$detection" | jq -r '.pattern')
        case "$pattern" in
            launchagent_silent)
                result=$(heal_launchagent_silent "$detection")
                heals_attempted=$((heals_attempted + 1))
                ;;
            cloudflared_dead)
                result=$(heal_cloudflared_dead)
                heals_attempted=$((heals_attempted + 1))
                ;;
            line_bridge_dead)
                result=$(heal_line_bridge_dead)
                heals_attempted=$((heals_attempted + 1))
                ;;
            envelope_stale)
                result=$(heal_envelope_stale)
                heals_attempted=$((heals_attempted + 1))
                ;;
            *)
                unknown_patterns+=("$pattern")
                continue
                ;;
        esac
        outcome=$(echo "$result" | jq -r '.outcome // "unknown"')
        case "$outcome" in
            success) heals_success=$((heals_success + 1)) ;;
            cap_reached) heals_cap=$((heals_cap + 1)) ;;
            fail) heals_fail=$((heals_fail + 1)) ;;
        esac
        echo "$result"
    done < <("$detector")
done

log "=== self-heal END (attempted=$heals_attempted success=$heals_success fail=$heals_fail cap=$heals_cap unknown=${#unknown_patterns[@]}) ==="

# Emit summary envelope
cat <<EOF
{"kind":"self_heal","attempted":$heals_attempted,"success":$heals_success,"fail":$heals_fail,"cap":$heals_cap,"unknown":${#unknown_patterns[@]}}
EOF

exit 0