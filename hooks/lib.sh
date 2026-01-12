#!/bin/bash
# Shared functions for cc-hud hooks
# NOTE: This file is sourced by other scripts, so we don't use set -e here

DB_PATH="${HOME}/.claude/statusline-usage.db"
MENUBAR_URL="http://localhost:19222"

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
  local status="$4"
  local now=$(date +%s)000  # milliseconds

  sqlite3 "$DB_PATH" "
    INSERT INTO hud_sessions (session_id, initial_cwd, git_branch, status, is_root_at_start, first_seen_at, last_seen_at)
    VALUES ('$session_id', '$cwd', '$git_branch', '$status', 0, $now, $now)
    ON CONFLICT(session_id) DO UPDATE SET
      git_branch = '$git_branch',
      status = '$status',
      last_seen_at = $now;
  "
}

# Delete session from database
db_delete_session() {
  local session_id="$1"
  sqlite3 "$DB_PATH" "DELETE FROM hud_sessions WHERE session_id = '$session_id';"
}

# Notify menu bar app (fire-and-forget)
notify_menubar() {
  local event="$1"
  local session_id="$2"
  local cwd="$3"
  local git_branch="$4"
  local status="$5"

  (curl -s -X POST "$MENUBAR_URL/session-update" \
    -H "Content-Type: application/json" \
    -d "{
      \"event\": \"$event\",
      \"session_id\": \"$session_id\",
      \"cwd\": \"$cwd\",
      \"git_branch\": \"$git_branch\",
      \"status\": \"$status\"
    }" &>/dev/null || true) &
}
