# Persona Councils

Turn saved AI User Personas (`data/personas.json`) into deliberating agents.

Historical council run artifacts may mention removed prototype fixture files.
Current app state lives in local JSON data files and does not import those
artifacts automatically.

- **Decision council** — personas rank/veto options; tally + synthesize a decision.
- **Strategy council** — personas debate a strategy question from their POV.
- **UI test** — each persona attempts a real task in a target app and reports friction.

## Mechanism (rally-workflows)
- **Tier 1 (default, cheap):** host subagents, ≤4 parallel, one per persona. Each
  returns a structured position; the orchestrator tallies/synthesizes. INDEPENDENT
  positions (parallel) avoid the anchoring that makes solicited peer review non-independent.
- **Tier 2 (scale / dogfood):** `rally run claude|codex --name <persona> --backend tmux`
  launches live persona-agents into Easy Terminal workspaces, each running a mini
  build-loop on its council task, coordinating via the ET rally room.

Author a workstream descriptor per `agent-rally-point/dynamic-workflows/PROTOCOL.md`,
lint with `workstream-lint.mjs`, then fan out.
