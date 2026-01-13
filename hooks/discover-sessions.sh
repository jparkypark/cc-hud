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

  # Find most recent session transcript (confirms this is a real Claude session)
  [ ! -d "$project_path" ] && continue
  recent=$(ls -t "$project_path"/*.jsonl 2>/dev/null | head -1)
  [ -z "$recent" ] && continue

  # Skip if session already exists (discovery only creates new entries)
  safe_cwd=$(escape_sql "$cwd")
  existing=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM hud_sessions WHERE cwd = '$safe_cwd';")
  [ "$existing" -gt 0 ] && continue

  # Get git branch
  git_branch=$(get_git_branch "$cwd")

  # Register as discovered
  db_upsert_session "$cwd" "$git_branch" "discovered"
done

exit 0
