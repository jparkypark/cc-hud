#!/bin/bash
# Hook: SessionEnd - called when Claude Code session ends
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Parse stdin JSON to get session_id
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty')

# Parse session info from environment
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Delete from hud_sessions database (blocking)
db_delete_session "$cwd"

# 2. Log event to session_events (blocking)
if [ -n "$session_id" ]; then
  db_log_event "$session_id" "end" "$cwd" "" ""
fi

# 3. Notify overlay (fire-and-forget)
notify_overlay "end" "$cwd" "" ""

exit 0
