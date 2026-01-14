#!/bin/bash
# Hook: SessionStart - called when Claude Code session starts or resumes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Parse stdin JSON to get session_id
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty')

# Parse session info from environment
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="working"

# 1. Write to hud_sessions database (blocking)
db_upsert_session "$cwd" "$git_branch" "$status"

# 2. Log event to session_events (blocking)
if [ -n "$session_id" ]; then
  db_log_event "$session_id" "start" "$cwd" "$git_branch" ""
fi

# 3. Notify overlay (fire-and-forget)
notify_overlay "start" "$cwd" "$git_branch" "$status"

exit 0
