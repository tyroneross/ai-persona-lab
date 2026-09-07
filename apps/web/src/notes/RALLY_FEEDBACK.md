# Rally-Point feedback from the AI User Personas dogfood

Source: Claude Code session `claude-ui-20260526232205` on the first
end-to-end two-agent run (Codex = architecture/data, Claude = UI).
Written from the agent operator's perspective. Codex is writing its
own assessment in parallel; this is the UI-agent view.

The protocol works. Below is what felt friction-free, what cost time
or attention, and what I would change before another agent picks
this up from scratch.

---

## What landed cleanly

1. Channel derivation from a non-git path still worked. The first
   run warned about path stability; once the dir was a real repo,
   the derived channel stayed stable through restart. Good default.
2. `preflight` returning `active_peers[]` + `peer_states[]` is the
   right shape. Active vs stopped vs intent in one view is exactly
   the question I had at every boundary.
3. Handoffs with `--files` and `--subject` were enough to carry
   intent without prose. Codex's response handoff with the three
   contract files was instantly actionable.
4. `before-write --auto-claim` returned `safe_to_write: true`
   cleanly and the conflict surface was empty when expected.

## Friction I hit

### 1. JSON envelope size dwarfs the signal

Every command returns the full envelope (`context.brief`, `packet`,
`session_state`, `cursor`, etc.) even when I only asked for one
thing (e.g. inbox). On `start` this is fine. On every subsequent
poll the envelope blew up my terminal scrollback. I ended up
piping through `python3 -c 'json.load(...)'` to get readable
peer/ack tuples.

Ask: a `--compact` or `--fields` flag that returns only named keys.
Or split `start` from `poll` so poll responses are bounded.

### 2. Pending handoffs don't surface in `agent_visible`

After two empty polls I assumed nothing had landed, but the third
poll showed handoffs with `age_seconds=160` and `age_seconds=150`
already sitting in `pending_acks_for_me`. The agent-visible action
stayed `continue_claim` the whole time rather than escalating.

Ask: when `pending_acks_for_me[]` is non-empty, raise
`agent_visible.required_action` to `acknowledge_handoff` (severity
`info` or `warn`) so a polling agent can tell at a glance.

### 3. `next` returns `idle` when handoffs are pending

Same root cause. With two handoffs unacked, `next` returned
`score: 0.0`, `reasoning: ["no pending handoffs, blockers, tasks,
or artifacts scored above threshold"]`. Either `next` reads a
different queue than `preflight` is, or scoring misses the
pending-ack path. From the agent seat it felt like a contradiction.

Ask: unify the source of truth between `next` and
`preflight.pending_acks_for_me`.

### 4. `--auto-claim` per file vs claiming the parent directory

I claimed `app/`, `src/`, `components/`, `styles/` at session
start. Then `hook before-write --path src/UI_PLAN.md --auto-claim`
created a *new* claim event for the single file. Redundant under a
broader directory claim from the same tool.

Ask: short-circuit auto-claim when the path is already covered by
a broader claim from the same `tool` + active session.

### 5. Stop semantics vs reclaim semantics

Codex stopped its first session, then started a fresh
`codex-arch-20260526233928` with a different intent. The old
session correctly shows as `stopped`, but the new session's claims
overlap with the old session's released claims with no visible
linkage. From the UI-agent seat I couldn't tell whether the two
are "same agent, new task" or "two unrelated runs."

Ask: a `previous_session_id` or `succeeded_by` link on the stopped
profile when a new session opens on the same `tool` within a
short window.

### 6. Per-file `hook before-write` is impractical at scaffold time

Writing 22 files for a Next.js scaffold means 22 hook calls. I
skipped them under the assumption parent-directory claims cover
this. If that assumption is wrong, the protocol is broken at
scaffold time. If it's right, the docs should say so explicitly.

Ask: document the claim hierarchy semantics. Currently inferred.

### 7. Handoff `--files` doesn't distinguish files vs directories

I passed `--files schemas` and `--files docs/data-contracts.md`
together. `--files schemas` semantics for a directory ref (does it
mean "current children" or "watch this dir ongoing") are not
documented.

Ask: clarify, or split into `--files` and `--paths`.

### 8. No "I'm still here" heartbeat

My session has been alive for ~25 minutes; Codex's first session
stopped cleanly but if it had crashed I'd see active claims with
growing `age_seconds` and no live process. There's no TTL or
liveness check on active claims.

Ask: configurable claim TTL (e.g. 30 min default) with a `refresh`
command; otherwise stale claims need manual `claim-release` after
a crash.

### 9. `recommended_next_action` is sticky

After the start envelope, the recommendation stayed
`continue_claim` even when the genuine next action was
`acknowledge_handoff`. I started ignoring the field after the
second poll because it didn't move. Once an agent has learned to
ignore a recommendation field, it's dead weight.

Ask: make the recommendation reactive to the most recent state
delta, not just the original claim event.

### 10. `next_commands` block is comfort, not utility

Helpful once on `start`, ignored after. Consider gating behind a
verbose flag or removing it from steady-state responses.

## Things I wanted but didn't try

- `watch` mode — polled instead because the dogfood was driven by
  a human switching terminals. Can't grade it from this run.
- `replay` — mentioned in the rules; not exercised.
- `ci gate` — not yet attempted.

## Two concrete rallies for the rally-point repo

1. **Compact mode + reactive `next`** — would shrink per-poll
   token + screen real-estate cost by an order of magnitude and
   would let agents trust the recommendation field again. Highest
   leverage change for agent-in-the-loop UX.
2. **Claim hierarchy + TTL semantics documented + enforced** —
   removes the two biggest ambiguities I hit. Right now I'm relying
   on inferred behavior.

If only one ships next, I would take #1.

---

Filed by Claude as part of session `claude-ui-20260526232205`.
Coordinate with Codex's parallel assessment
(`codex-arch-20260526233928`) before promoting to a rally-point
issue.
