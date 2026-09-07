# Long-term ideas

Parking lot for directions we have discussed but not committed to. Not a
promise — a place so ideas are not lost. Move an item into a plan when it is
picked up.

## Autonomy of council execution

The council writeback loop is agent-driven: the app emits a command packet + API,
and a host agent runs the passes and writes results back. Options for removing
more of the human touch, cheapest to most hands-off:

- **A. Skill-driven (DONE, 2026-07-07).** `/persona-lab:run` + the headless
  council API (`/api/councils/rosters|runs|{id}|.../findings|.../synthesis|.../status`).
  You invoke it with a run id (or topic+roster); the host spawns one independent
  subagent per persona pass and drives the run to `complete`. Executor = host
  subagents; keeps the app LLM-free. Hard budget gate at 20 total passes.
- **B. Rally workflow (scale).** Fan out N live persona-agents via rally-workflows
  (the proven 10-100 Haiku path). Trigger = launch a workstream; executor = live
  rally agents; best for large panels. More infra than A.
- **C. Local-LLM CLI (headless).** Add `persona run <id>` that calls a local model
  (ollama-local / on-device) to execute each pass and curls findings back. Truly
  headless, no coding agent in the loop; matches "local LLMs execute." Cost: the
  CLI gains an LLM dependency it deliberately does not have today.
- **D. Background daemon (fully hands-off).** A poller that watches for
  `draft`/`ready` runs and dispatches them via B or C with no human at all. Adds a
  long-running process + the biggest cost/safety surface — only safe with the
  budget gate as a hard cap, not advisory.

Design invariant to preserve: LLM stays OUTSIDE the Next app (in the skill, the
CLI, or agents), never inside it — the app is the deterministic, no-key core.

## Adjacent ideas

- **Human findings-entry UI.** A form on the run detail to record findings /
  synthesis by hand, complementing the API (for when a person, not an agent, runs
  a pass).
- **Budget as a hard server cap.** Promote the 20-pass warning to an absolute
  ceiling enforced in `createRun` / the run command (with an explicit override),
  so no path can silently spend thousands of LLM calls.
- **Two-copies → one canonical.** `publish-sync.sh` keeps the dev copy and the
  published `tyroneross/persona-lab` repo aligned; longer term, make the standalone
  repo canonical and symlink it into the app (matches the toolkit convention).
- **CLI `--runs` awareness.** Let `persona panel` reflect runs-per-persona and the
  token warning, mirroring the app.
- **Roster reconciliation.** Decide whether the CLI's global `rosters/` and the
  app's `RepoPersonaRoster` should unify or stay two granularities (light vs
  large-panel). Currently deliberately separate.
- **Grounding personas in real evidence.** Import interview/survey/analytics
  snippets so personas can carry `provenance: synthetic-grounded` instead of
  `synthetic-assumed` — the single biggest quality lever from the research.
