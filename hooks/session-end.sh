#!/bin/bash
# Hook: SessionEnd - called when Claude Code session ends
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Consume stdin (required by Claude Code hooks, but we don't need the content)
cat > /dev/null

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_WORKING_DIRECTORY:-$(pwd)}"

# 1. Delete from database (blocking)
db_delete_session "$session_id"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "end" "$session_id" "$cwd" "" ""

exit 0
