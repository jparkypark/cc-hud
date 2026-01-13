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

  # Extract session ID from filename
  session_id=$(basename "$recent" .jsonl)

  # Skip agent transcripts (they have different naming)
  [[ "$session_id" == agent-* ]] && continue

  # Get git branch
  git_branch=$(get_git_branch "$cwd")

  # Register session with unknown status (hooks will correct it)
  db_upsert_session "$session_id" "$cwd" "$git_branch" "unknown"
done

exit 0
