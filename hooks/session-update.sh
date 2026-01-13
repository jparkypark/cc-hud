#!/bin/bash
# Hook: Notification (idle_prompt) - called when Claude is waiting for input
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Consume stdin (required by Claude Code hooks, but we don't need the content)
cat > /dev/null

# Parse session info from environment
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="waiting"

# 1. Write to database (blocking)
db_upsert_session "$cwd" "$git_branch" "$status"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "update" "$cwd" "$git_branch" "$status"

exit 0
