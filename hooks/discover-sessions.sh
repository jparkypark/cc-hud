#!/bin/bash
# Discover running Claude Code sessions and register them in the database
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Find all running Claude CLI processes
for pid in $(ps aux | grep "[c]laude" | grep -v "Claude.app" | awk '{print $2}'); do
  # Get working directory from process
  cwd=$(lsof -p "$pid" 2>/dev/null | awk '/cwd/ {print $NF}')
  [ -z "$cwd" ] && continue

  # Convert cwd to project directory format
  project_dir=$(echo "$cwd" | sed 's|^/||' | sed 's|/|-|g')
  project_path="$HOME/.claude/projects/-$project_dir"

  # Find most recent session transcript
  [ ! -d "$project_path" ] && continue
  recent=$(ls -t "$project_path"/*.jsonl 2>/dev/null | head -1)
  [ -z "$recent" ] && continue

  # Skip if a non-discovered session already exists for this cwd
  safe_cwd=$(escape_sql "$cwd")
  existing=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM hud_sessions WHERE initial_cwd = '$safe_cwd' AND session_id NOT LIKE 'discovered-%' AND session_id NOT LIKE 'hook-%';")
  [ "$existing" -gt 0 ] && continue

  # Use a discoverable session ID based on cwd (will be replaced when hooks fire)
  session_id="discovered-$(echo "$cwd" | md5 | cut -c1-16)"

  # Get git branch
  git_branch=$(get_git_branch "$cwd")

  # Register as discovered (will be replaced when hooks fire with real session ID)
  db_upsert_session "$session_id" "$cwd" "$git_branch" "discovered"
done

exit 0
