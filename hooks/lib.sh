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

# Update session in database (cwd is the primary key)
db_upsert_session() {
  local cwd="$1"
  local git_branch="$2"
  local session_status="$3"
  local now=$(date +%s)000  # milliseconds

  # Escape values to prevent SQL injection
  local safe_cwd=$(escape_sql "$cwd")
  local safe_git_branch=$(escape_sql "$git_branch")
  local safe_status=$(escape_sql "$session_status")

  sqlite3 "$DB_PATH" "
    INSERT INTO hud_sessions (cwd, git_branch, status, first_seen_at, last_seen_at)
    VALUES ('$safe_cwd', '$safe_git_branch', '$safe_status', $now, $now)
    ON CONFLICT(cwd) DO UPDATE SET
      git_branch = '$safe_git_branch',
      status = '$safe_status',
      last_seen_at = $now;
  "
}

# Delete session from database
db_delete_session() {
  local cwd="$1"
  local safe_cwd=$(escape_sql "$cwd")
  sqlite3 "$DB_PATH" "DELETE FROM hud_sessions WHERE cwd = '$safe_cwd';"
}

# Notify menu bar app (fire-and-forget)
notify_menubar() {
  local event="$1"
  local cwd="$2"
  local git_branch="$3"
  local session_status="$4"

  # Use jq for proper JSON escaping
  local json=$(jq -n \
    --arg event "$event" \
    --arg cwd "$cwd" \
    --arg git_branch "$git_branch" \
    --arg status "$session_status" \
    '{event: $event, cwd: $cwd, git_branch: $git_branch, status: $status}')

  (curl -s -X POST "$MENUBAR_URL/session-update" \
    --connect-timeout 1 --max-time 2 \
    -H "Content-Type: application/json" \
    -d "$json" &>/dev/null || true) &
}
