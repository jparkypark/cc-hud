#!/bin/bash
# Shared functions for cc-hud hooks
# NOTE: This file is sourced by other scripts, so we don't use set -e here

DB_PATH="${HOME}/.claude/statusline-usage.db"
MENUBAR_URL="http://localhost:19222"

# Escape single quotes for SQL strings (prevents SQL injection)
escape_sql() {
  echo "${1//\'/\'\'}"
}

# Get git branch for a directory
get_git_branch() {
  local dir="$1"
  git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

# Update session in database
db_upsert_session() {
  local session_id="$1"
  local cwd="$2"
  local git_branch="$3"
  local session_status="$4"
  local now=$(date +%s)000  # milliseconds

  # Escape values to prevent SQL injection
  local safe_session_id=$(escape_sql "$session_id")
  local safe_cwd=$(escape_sql "$cwd")
  local safe_git_branch=$(escape_sql "$git_branch")
  local safe_status=$(escape_sql "$session_status")

  sqlite3 "$DB_PATH" "
    INSERT INTO hud_sessions (session_id, initial_cwd, git_branch, status, is_root_at_start, first_seen_at, last_seen_at)
    VALUES ('$safe_session_id', '$safe_cwd', '$safe_git_branch', '$safe_status', 0, $now, $now)
    ON CONFLICT(session_id) DO UPDATE SET
      git_branch = '$safe_git_branch',
      status = '$safe_status',
      last_seen_at = $now;
  "
}

# Delete session from database
db_delete_session() {
  local session_id="$1"
  local safe_session_id=$(escape_sql "$session_id")
  sqlite3 "$DB_PATH" "DELETE FROM hud_sessions WHERE session_id = '$safe_session_id';"
}

# Notify menu bar app (fire-and-forget)
notify_menubar() {
  local event="$1"
  local session_id="$2"
  local cwd="$3"
  local git_branch="$4"
  local session_status="$5"

  # Use jq for proper JSON escaping
  local json=$(jq -n \
    --arg event "$event" \
    --arg session_id "$session_id" \
    --arg cwd "$cwd" \
    --arg git_branch "$git_branch" \
    --arg status "$session_status" \
    '{event: $event, session_id: $session_id, cwd: $cwd, git_branch: $git_branch, status: $status}')

  (curl -s -X POST "$MENUBAR_URL/session-update" \
    --connect-timeout 1 --max-time 2 \
    -H "Content-Type: application/json" \
    -d "$json" &>/dev/null || true) &
}
