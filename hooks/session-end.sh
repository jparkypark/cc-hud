#!/bin/bash
# Hook: SessionEnd - called when Claude Code session ends
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Consume stdin (required by Claude Code hooks, but we don't need the content)
cat > /dev/null

# Parse session info from environment
# Session ID is extracted from CLAUDE_ENV_FILE path (e.g., .../session-env/<uuid>/hook-0.sh)
session_id=$(basename "$(dirname "${CLAUDE_ENV_FILE:-}")" 2>/dev/null || echo "unknown")
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Delete from database (blocking)
db_delete_session "$session_id"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "end" "$session_id" "$cwd" "" ""

exit 0
