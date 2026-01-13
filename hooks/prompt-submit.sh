#!/bin/bash
# Hook: UserPromptSubmit - called when user submits a prompt
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Consume stdin (required by Claude Code hooks)
cat > /dev/null

# Parse session info from environment
# Session ID is extracted from CLAUDE_ENV_FILE path (e.g., .../session-env/<uuid>/hook-0.sh)
session_id=$(basename "$(dirname "${CLAUDE_ENV_FILE:-}")" 2>/dev/null || echo "unknown")
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="working"

# 1. Write to database (blocking)
db_upsert_session "$session_id" "$cwd" "$git_branch" "$status"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "update" "$session_id" "$cwd" "$git_branch" "$status"

exit 0
