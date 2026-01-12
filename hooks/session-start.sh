#!/bin/bash
# Hook: SessionStart - called when Claude Code session starts or resumes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Read hook input from stdin (required by Claude Code hooks)
input=$(cat)

# Parse session info from environment
session_id="${CLAUDE_SESSION_ID:-unknown}"
cwd="${CLAUDE_PROJECT_DIR:-$(pwd)}"
git_branch=$(get_git_branch "$cwd")
status="working"

# 1. Write to database (blocking)
db_upsert_session "$session_id" "$cwd" "$git_branch" "$status"

# 2. Notify menu bar (fire-and-forget)
notify_menubar "start" "$session_id" "$cwd" "$git_branch" "$status"

exit 0
