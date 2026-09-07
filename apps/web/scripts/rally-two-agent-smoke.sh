#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RALLY="${RALLY:-/Users/tyroneross/dev/git-folder/agent-rally-point/target/release/rally}"

if [[ ! -x "$RALLY" ]]; then
  echo "Rally binary not found or not executable: $RALLY" >&2
  echo "Build it with: cd /Users/tyroneross/dev/git-folder/agent-rally-point && cargo build --workspace --release" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this smoke test" >&2
  exit 1
fi

cd "$APP_DIR"

RUN_ID="$(date +%Y%m%d%H%M%S)"
CODEX_SESSION="codex-smoke-$RUN_ID"
CLAUDE_SESSION="claude-smoke-$RUN_ID"

"$RALLY" start codex \
  --session-id "$CODEX_SESSION" \
  --intent "smoke test architecture/data coordination" \
  --path docs/architecture.md \
  --json >/tmp/rally-codex-smoke-start.json

"$RALLY" start claude_code \
  --session-id "$CLAUDE_SESSION" \
  --intent "smoke test UI coordination" \
  --path CLAUDE.md \
  --json >/tmp/rally-claude-smoke-start.json

"$RALLY" preflight --tool codex --session-id "$CODEX_SESSION" --json >/tmp/rally-codex-smoke-view.json
"$RALLY" preflight --tool claude_code --session-id "$CLAUDE_SESSION" --json >/tmp/rally-claude-smoke-view.json

jq -e --arg sid "$CLAUDE_SESSION" '.active_peers[] | select(.tool == "claude_code" and .session_id == $sid)' /tmp/rally-codex-smoke-view.json >/dev/null
jq -e --arg sid "$CODEX_SESSION" '.active_peers[] | select(.tool == "codex" and .session_id == $sid)' /tmp/rally-claude-smoke-view.json >/dev/null

"$RALLY" stop codex --session-id "$CODEX_SESSION" --reason "smoke complete" --json >/tmp/rally-codex-smoke-stop.json
"$RALLY" stop claude_code --session-id "$CLAUDE_SESSION" --reason "smoke complete" --json >/tmp/rally-claude-smoke-stop.json

"$RALLY" preflight --tool codex --session-id "$CODEX_SESSION-final" --json >/tmp/rally-smoke-final-view.json

jq -e --arg sid "$CODEX_SESSION" '.peer_states[] | select(.tool == "codex" and .session_id == $sid and .availability == "stopped")' /tmp/rally-smoke-final-view.json >/dev/null
jq -e --arg sid "$CLAUDE_SESSION" '.peer_states[] | select(.tool == "claude_code" and .session_id == $sid and .availability == "stopped")' /tmp/rally-smoke-final-view.json >/dev/null

echo "Rally two-agent smoke passed"
echo "codex_session=$CODEX_SESSION"
echo "claude_session=$CLAUDE_SESSION"
echo "channel=$(jq -r '.channel' /tmp/rally-smoke-final-view.json)"
