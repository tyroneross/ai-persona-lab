# Rally Point User Communication Recommendations

Date: 2026-05-26 PT / 2026-05-27 UTC
Source run: AI User Personas first two-agent dogfood
Primary user problem: the human cannot reliably tell whether agent work is still in progress, stopped, stale, or waiting on a handoff.

## Recommendation

Ship Rally's next improvement around status legibility before adding richer orchestration.

The first product gap is not that Rally lacks coordination concepts. The dogfood showed claims, profiles, handoffs, stop state, and peer state are already useful. The gap is that the current surfaces make the human and agent infer liveness from mixed signals:

- `active_peers[]` can be empty while `peer_states[]` still says a session is `active`.
- stale claims keep looking like live ownership.
- `next` and `recommended_next_action` can report idle or continue-claim while pending handoffs exist.
- every steady-state command returns a large envelope, so agents pipe output through ad hoc filters and humans lose the signal.

The highest leverage fix is a compact status and liveness layer:

1. Add `rally status --tty` for humans.
2. Add compact machine output via `--compact` or `--fields`.
3. Classify session state as `live`, `stale`, `stopped`, or `unknown`.
4. Make `next`, `preflight`, and `agent_visible.required_action` use the same pending-work source.
5. Document and enforce claim hierarchy and claim TTL semantics.
6. Add a standby/wake contract after status truth is reliable: event-driven first, scheduled wake as fallback.

## Why This Comes First

Rally's value proposition is shared situational awareness across agents. If the user has to ask "is anything still running?" Rally is not yet carrying the most important state.

The observed failure mode is especially damaging because the protocol partly works. Rally preserves enough data to show intent and ownership, but the final interpretation is ambiguous. That creates false confidence: an agent can see `availability: active` and claims, while the actual presence heartbeat is stale or missing.

This should be fixed before adding event-triggered resume, richer handoff types, or workflow automation. Those features depend on the same liveness and next-action truth.

The follow-on model should be event-driven first and scheduled wake as fallback. Event-driven Rally communication is enough while an agent is alive and polling or watching Rally. It is not enough after the agent stops, crashes, or the human closes the terminal. In that case Rally is a durable coordination ledger, but it is not automatically an agent runtime scheduler unless a separate runner layer exists.

## Dogfood Evidence

Codex-side observations:

- A Claude UI session appeared in `peer_states[]` as `availability: active` with UI claims, while `active_peers[]` was empty.
- The same claims aged past 20 minutes with no clear stale classification.
- Rally preserved stopped Codex sessions correctly, which proves durable state works.
- The missing concept is current liveness, not historical session state.

Claude-side observations from `src/notes/RALLY_FEEDBACK.md`:

- Command envelopes are too large for repeated polling.
- `pending_acks_for_me[]` did not reliably surface through `agent_visible`.
- `next` returned idle even when pending handoffs existed.
- `--auto-claim` created a redundant child-file claim under an already claimed parent directory.
- Per-file `before-write` hooks are impractical during scaffolds.
- `--files` does not distinguish file refs from directory refs.
- repeated `--files` flags kept only the later value during the Codex handoff, so multi-file handoffs should either reject repeated flags clearly or merge them.
- crash or abandoned-session claims have no documented TTL or reclaim behavior.
- stopped-to-new-session continuity has no `previous_session_id` or `succeeded_by` link.

## Key Hypotheses

1. A compact human status command will reduce most user confusion without changing the core event protocol.

Acceptance signal: a user can run one command and answer: who is live, who is stale, who stopped, what is claimed, what is waiting, and what should happen next.

2. A shared pending-work source will make agents trust `next` again.

Acceptance signal: if `preflight.pending_acks_for_me[]` is non-empty, then `next` and `agent_visible.required_action` also reflect the handoff instead of returning idle or continue-claim.

3. Liveness classification is more useful than raw presence.

Acceptance signal: old active profiles with expired presence become `stale`, not `active`, and stale claims are rendered differently from live claims.

4. Claim hierarchy removes scaffold friction.

Acceptance signal: once `src/` is claimed by a session, `hook before-write --path src/foo.ts --auto-claim` does not create a redundant child claim for the same tool and session.

5. TTL and reclaim semantics will prevent abandoned work from blocking future agents.

Acceptance signal: stale claims have documented age thresholds, warning language, and a safe reclaim or force-release flow.

6. A standby/wake contract will remove ambiguity during intentional waiting periods.

Acceptance signal: an agent can stop active work while recording whether it should wake on a handoff, stale claim, peer stop, failed gate, or scheduled fallback check.

## Assumptions

- Rally should remain event-log first; recommendations should derive from the existing channel state rather than introducing a separate database.
- Presence files are acceptable for fresh liveness, but durable profiles should not be interpreted as live presence after the heartbeat expires.
- Directory claims are intended to cover descendant paths unless docs or implementation explicitly say otherwise.
- The first implementation should optimize for local two-agent dogfood before remote or distributed multi-host complexity.
- A human-readable status surface should be stable enough for users, while JSON output should stay available for adapters.
- Rally should own coordination truth and due-work semantics; an external runner should own time-based execution.
- Scheduled wake is necessary for uncertainty, but it should be a fallback behind event-driven handoff/ack/watch flow.

## Proposed Implementation Plan

### P0: Fix Status Truth

Add liveness classification to preflight/status projection:

- `live`: fresh presence record exists within `stale_after_seconds`.
- `stale`: profile or claims exist, but no fresh presence.
- `stopped`: latest session profile says stopped.
- `unknown`: records exist but are incomplete, anonymous, or not session-linked.

Render this in:

- `preflight.peer_states[]`
- `active_claims[]` summaries
- new `rally status --tty`
- compact JSON output

### P0: Add `rally status --tty`

Target shape:

```text
Rally status: AI User Personas

Live
- codex codex-rally-rec-20260526235045: writing recommendation doc

Stale
- claude_code claude-ui-20260526232205: last heartbeat 28m ago, claims app/ src/ components/ styles/

Stopped
- codex codex-arch-20260526232203: architecture and data contracts handed to Claude

Waiting
- codex needs response: UI shell shipped; persistence owner requested

Recommended next
- codex: acknowledge or complete pending handoff
```

TTY output should omit full context packets and show the top actionable items first.

### P0: Unify `next`, `preflight`, and `agent_visible`

Use one pending-work projection for:

- pending handoffs
- blockers
- claim conflicts
- stale claims requiring reclaim/confirm
- active peer join decisions

Rules:

- pending handoff to this tool beats continue-claim.
- claim conflict beats normal work.
- stale claim warning appears before write approval when overlapping.
- `next` must not say idle while `preflight.pending_acks_for_me[]` is non-empty.

### P1: Compact Output Mode

Add either:

- `--compact`, returning bounded keys for the command type, or
- `--fields a,b,c`, returning explicitly requested top-level fields.

Suggested defaults:

- `start`: full envelope remains acceptable.
- `preflight`, `inbox`, `next`, `claims`, `hook`: compact by default for TTY, full with `--json --verbose` or equivalent.

### P1: Claim Hierarchy

Define and enforce:

- a claim on `src/` covers `src/**`.
- a child claim under the same tool and session is redundant.
- a child claim under a different tool is a conflict unless explicitly allowed.
- `--auto-claim` should no-op when covered by same-session parent claim.

Add tests around:

- parent directory covers child path.
- sibling directory does not cover child path.
- same tool different session either warns or links succession.
- different tool conflicts.

### P1: Claim TTL And Reclaim Flow

Add TTL semantics:

- default warning threshold: 10 minutes without fresh presence.
- default stale threshold: 30 minutes without fresh presence.
- claims from stopped sessions should release on `stop` as today.
- claims from crashed sessions become stale and can be reclaimed with an explicit command or hook response.

Possible commands:

```bash
rally claim refresh --tool <tool> --session-id <id> --json
rally release --stale --tool <tool> <claim-id> --reason "reclaim stale session" --json
```

Do not make TTL silently delete claims in the first version. Start with status warnings and explicit reclaim.

### P2: Session Succession

When a tool starts a new session soon after stopping or going stale, optionally record:

- `previous_session_id`
- `succeeded_by`
- `started_after`
- `same_tool_successor: true`

This helps distinguish "same agent continued in a new terminal" from "separate concurrent run."

### P2: Standby And Wake Contract

Add an explicit standby state so an agent can intentionally stop active work without disappearing from the coordination plan.

Profile fields:

- `availability: standby`
- `wake_conditions`: pending handoff, peer stopped, claim stale, gate failed
- `standby_until`: timestamp
- `expected_next_check`: timestamp
- `standby_reason`: short explanation for the human and next agent

Closeout intent examples:

- "I am done unless Claude sends a handoff."
- "Wake/check again in 15 minutes if Claude has not stopped."
- "Release my claims now, keep watching this thread."
- "Run final gate after both peers are stopped or standby."

Conceptual command:

```bash
rally standby codex \
  --session-id codex-arch-123 \
  --wake-at "2026-05-27T07:15:00Z" \
  --wake-on handoff,to=codex \
  --wake-on stale-claim,tool=claude_code,after=30m \
  --reason "check whether Claude finished UI closeout"
```

`rally next` should then be able to say:

- "You are done. Stop."
- "Go standby until X."
- "Wake needed: Claude stale claim."
- "Do not stop: pending handoff to you."

Rally should not become a full job runner. It should define the standby/wake contract and expose machine-readable due work. A separate runner can execute wakeups:

- Codex heartbeat automation
- LaunchAgent
- cron
- CI job
- local daemon
- hosted worker

### P2: Done Criteria In The Ledger

Let agents publish a closeout checklist so the final state is explicit instead of inferred.

Example checklist:

- no pending handoffs
- no blockers
- no conflicts
- all owned claims released
- peer states stopped or intentionally standby
- final gate passed

This gives `rally status --tty`, `rally next`, and `rally ci gate` the same definition of "done."

### P2: Handoff Path Semantics

Clarify or split:

- `--files` for concrete files.
- `--paths` for files or directories.
- directory refs mean "the current directory scope is relevant," not an immutable snapshot of children.
- repeated `--files` flags either merge values or fail with a clear parser error. Silent last-write-wins behavior is dangerous for handoffs.

## Acceptance Criteria

- A human can run `rally status --tty` and know whether each agent is live, stale, stopped, or waiting.
- A polling agent can trust `agent_visible.required_action`.
- `rally next --tool codex --json` reports a pending handoff when one exists for Codex.
- redundant child auto-claims are not created under same-session parent claims.
- stale claims are clearly labeled and do not look like active ownership.
- docs explain claim hierarchy, TTL, reclaim, and file-vs-directory path semantics.
- agents can publish standby intent with wake conditions and expected next check.
- Rally can expose due standby work without owning the scheduler that runs it.

## Suggested Handoff To Rally-Point Implementer

Start with a narrow PR:

1. Implement shared pending-work projection for `next`, `preflight`, and `agent_visible`.
2. Add liveness state to peer/session rendering.
3. Add `rally status --tty` using the compact projection.
4. Add tests for pending handoff priority and stale/live session classification.

Then follow with a second PR:

1. Add compact output flags.
2. Implement claim hierarchy no-op for same-session parent coverage.
3. Document claim TTL and add stale warning behavior.

Then follow with a third PR:

1. Add `availability: standby` and standby metadata to profiles.
2. Add a `rally standby` command or equivalent profile shortcut.
3. Add due-work projection for wake conditions.
4. Add closeout checklist events and status rendering.

## Out Of Scope For The First Fix

- automatic resume triggers such as `will_resume_on`.
- background notification daemons or job runners.
- distributed remote-agent sync.
- silent TTL deletion of claims.
- persona app persistence work.

Those may matter later, but they should not precede reliable status truth.
