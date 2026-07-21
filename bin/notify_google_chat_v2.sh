#!/usr/bin/env bash
# bin/notify_google_chat_v2.sh — gogcli-based shell rewrite of notify_google_chat.py
# Uses encrypted-file keyring (gogcli) + curl for Google Chat webhook.
# Schedule: Mon-Fri 8:30 (managed by LaunchAgent ai.openclaw.team-leave-google-chat).
#
# Usage:
#   notify_google_chat_v2.sh                       # today, send unless already sent
#   notify_google_chat_v2.sh 2026-07-21           # specific date
#   notify_google_chat_v2.sh 2026-07-21 --dry-run # print message, don't send
#   notify_google_chat_v2.sh 2026-07-21 --force   # send even if already sent today

set -euo pipefail

PROJECT="/Users/nova/.openclaw/workspace/team-leave-management"
GOG_ENV="/Users/nova/.openclaw/workspace/.env-gog"
ENV_FILE="$PROJECT/.env.google-chat"
SHEET_RESULT="$PROJECT/google-sheet-result.json"
STATE_FILE="$PROJECT/.leave-chat-notify-state.json"
LOG_FILE="$PROJECT/logs/google-chat-leave-job.log"
ACCOUNT="nova.os.ai@gmail.com"

# --- parse args ---
DATE=""
DRY_RUN=""
FORCE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --date=*) DATE="${1#--date=}" ;;
    --date) DATE="$2"; shift ;;
    --dry-run) DRY_RUN="1" ;;
    --force) FORCE="1" ;;
    --help|-h) echo "Usage: $0 [DATE|--date=DATE] [--dry-run] [--force]"; exit 0 ;;
    -*) echo "Unknown flag: $1" >&2; exit 1 ;;
    *) [ -z "$DATE" ] && DATE="$1" ;;
  esac
  shift
done
DATE="${DATE:-$(date +%Y-%m-%d)}"

# --- load env files (parse line-by-line to handle & in URLs) ---
load_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ""|\#*) continue ;;  # skip empty + comments
    esac
    local key="${line%%=*}"
    local value="${line#*=}"
    # strip surrounding quotes
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    # set if not already set (matches Python's setdefault)
    [ -z "${!key+x}" ] && export "$key=$value"
  done < "$file"
}
load_env "$ENV_FILE"
load_env "$GOG_ENV"

# --- get sheet id ---
if [ ! -f "$SHEET_RESULT" ]; then
  echo "ERROR: $SHEET_RESULT not found" >&2
  exit 1
fi
SHEET_ID=$(jq -r '.spreadsheet_id' "$SHEET_RESULT")
if [ -z "$SHEET_ID" ] || [ "$SHEET_ID" = "null" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%S+00:00) ERROR: spreadsheet_id missing" >> "$LOG_FILE"
  echo "ERROR: spreadsheet_id not found in $SHEET_RESULT" >&2
  exit 1
fi

# --- skip check (skip if already sent today, unless --force or --dry-run) ---
LAST_SENT=$(jq -r '.last_sent_date // ""' "$STATE_FILE" 2>/dev/null || echo "")
if [ -z "$FORCE" ] && [ -z "$DRY_RUN" ] && [ "$LAST_SENT" = "$DATE" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%S+00:00) skip duplicate target_date=$DATE" >> "$LOG_FILE"
  echo "skip duplicate target_date=$DATE"
  exit 0
fi

# --- fetch both sheets via gog (encrypted-file keyring handles auth) ---
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

if ! gog --account "$ACCOUNT" --readonly --no-input --json sheet get "$SHEET_ID" "Members!A:Z" > "$TMPDIR/members.json" 2>"$TMPDIR/members.err"; then
  echo "ERROR: gog sheet get Members failed: $(cat "$TMPDIR/members.err")" >&2
  exit 1
fi
if ! gog --account "$ACCOUNT" --readonly --no-input --json sheet get "$SHEET_ID" "Leave Requests!A:Z" > "$TMPDIR/requests.json" 2>"$TMPDIR/requests.err"; then
  echo "ERROR: gog sheet get Leave Requests failed: $(cat "$TMPDIR/requests.err")" >&2
  exit 1
fi

# --- parse + filter + format (use Python helper for data transform) ---
MESSAGE=$(python3 /Users/nova/.openclaw/workspace/bin/build_leave_message.py \
  "$DATE" \
  "$TMPDIR/members.json" \
  "$TMPDIR/requests.json")

# --- dry-run: just print message ---
if [ -n "$DRY_RUN" ]; then
  echo "$MESSAGE"
  exit 0
fi

# --- send to Google Chat webhook ---
WEBHOOK="${GOOGLE_CHAT_WEBHOOK_URL:-}"
if [ -z "$WEBHOOK" ]; then
  echo "ERROR: GOOGLE_CHAT_WEBHOOK_URL is missing. Put it in $ENV_FILE" >&2
  exit 1
fi

PAYLOAD=$(jq -nc --arg text "$MESSAGE" '{text: $text}')

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$WEBHOOK" || echo "000")

if [ "$HTTP_CODE" -ge 400 ] 2>/dev/null; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%S+00:00) send failed target_date=$DATE http=$HTTP_CODE" >> "$LOG_FILE"
  echo "ERROR: Google Chat returned HTTP $HTTP_CODE" >&2
  exit 1
fi

# --- save state + log ---
# Use awk to count "- " lines (always emits a clean number, no grep edge cases)
COUNT=$(printf '%s\n' "$MESSAGE" | awk '/^- / {n++} END {print n+0}')
NOW=$(date -u +%Y-%m-%dT%H:%M:%S+00:00)
jq -n --arg date "$DATE" --arg at "$NOW" --argjson count "$COUNT" \
  '{last_sent_date: $date, last_sent_at: $at, last_count: $count}' > "$STATE_FILE"
echo "$(date -u +%Y-%m-%dT%H:%M:%S+00:00) sent target_date=$DATE count=$COUNT" >> "$LOG_FILE"
echo "sent target_date=$DATE count=$COUNT"
