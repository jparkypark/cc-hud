#!/bin/bash
# Hook: SessionEnd - called when Claude Code session ends
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Read hook input from stdin (required by Claude Code hooks)
input=$(cat)

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Delete from database (blocking)
db_delete_session "$session_id"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "end" "$session_id" "$cwd" "" ""

exit 0
