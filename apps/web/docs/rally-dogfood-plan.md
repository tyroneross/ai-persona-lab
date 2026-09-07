# Rally Dogfood Plan: AI User Personas

## Goal

Use Agent Rally Point to coordinate one Claude Code terminal and one Codex /
ChatGPT terminal while building the AI User Personas app.

## Roles

| Agent | Tool id | Primary ownership | Secondary behavior |
| --- | --- | --- | --- |
| Claude Code | `claude_code` | UI shell, components, visual states, frontend tests | Requests missing data/API details from Codex |
| Codex / ChatGPT | `codex` | Architecture, data inputs/outputs, schemas, integration flow | Suggests UI additions by handoff, not direct UI edits |

## Phase 0: Connection Smoke

Run from this directory:

```bash
scripts/rally-two-agent-smoke.sh
```

Pass condition:

- `codex` and `claude_code` can both start.
- each can see the other in `active_peers[]`.
- `stop` removes active peers and preserves stopped state in `peer_states[]`.

## Phase 1: Start Real Terminals

Terminal A, Codex / ChatGPT:

```bash
export RALLY="${RALLY:-/Users/tyroneross/dev/git-folder/agent-rally-point/target/release/rally}"
export SESSION_ID="codex-arch-$(date +%Y%m%d%H%M%S)"
cd "/Users/tyroneross/dev/git-folder/AI User Personas"
"$RALLY" start codex \
  --session-id "$SESSION_ID" \
  --intent "define AI User Personas architecture, data inputs, outputs, and UI suggestions" \
  --path docs/architecture.md \
  --path docs/data-contracts.md \
  --path schemas \
  --json
```

Terminal B, Claude Code:

```bash
export RALLY="${RALLY:-/Users/tyroneross/dev/git-folder/agent-rally-point/target/release/rally}"
export SESSION_ID="claude-ui-$(date +%Y%m%d%H%M%S)"
cd "/Users/tyroneross/dev/git-folder/AI User Personas"
"$RALLY" start claude_code \
  --session-id "$SESSION_ID" \
  --intent "build AI User Personas UI shell and screens" \
  --path app \
  --path src \
  --path components \
  --path styles \
  --json
```

Both terminals should confirm the other appears in `active_peers[]`.

## Phase 2: First Work Packets

Codex creates or updates:

- `docs/architecture.md`
- `docs/data-contracts.md`
- `schemas/persona.schema.json`

Codex then handoffs frontend requirements:

```bash
"$RALLY" handoff \
  --to claude_code \
  --from-tool codex \
  --subject "Implement the first UI from the persona data contract" \
  --files docs/data-contracts.md schemas/persona.schema.json \
  --json
```

Claude creates or updates the app UI based on the chosen stack. If no stack
exists yet, Claude should propose the minimal scaffold first and hand off any
architecture decision back to Codex.

Claude then acknowledges the Codex handoff:

```bash
"$RALLY" ack --tool claude_code <handoff-id> --summary "UI shell connected to data contract" --json
```

## Phase 3: Mid-Run Checks

Both terminals run:

```bash
"$RALLY" inbox --tool <codex|claude_code> --session-id "$SESSION_ID" --since-cursor --json
"$RALLY" claims --json
"$RALLY" conflicts --json
"$RALLY" next --tool <codex|claude_code> --json
```

Pass condition:

- no unexpected claim conflicts.
- each terminal sees current peer intent.
- handoffs are acknowledged or explicitly marked `needs-info`.

## Phase 4: Closeout

Each terminal stops cleanly:

```bash
"$RALLY" stop <codex|claude_code> --session-id "$SESSION_ID" --reason "done" --json
```

Final verification:

```bash
"$RALLY" preflight --tool codex --session-id final-check --json
"$RALLY" ci gate --tool ci --json
```

Pass condition:

- no live active peers remain after both terminals stop.
- stopped sessions remain visible in `peer_states[]`.
- claims are released.
- CI gate passes or clearly reports a coordination issue.

## What This Test Proves

- Agents can discover each other at session start.
- Agents can see peer intent and owned files.
- UI and architecture/data work can proceed in parallel without silent overlap.
- Handoffs route concrete work between agents.
- Stop state is explicit, not just absence from presence.
