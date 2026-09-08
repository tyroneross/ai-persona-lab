---
name: persona-output-comparison
description: Build a task-adapted dashboard for comparing independent persona outputs, selecting useful parts, and letting an agent read the user's saved choices directly.
---

# Compare persona outputs

Use this workflow when a user wants to compare alternative outputs and choose what to keep.

## Establish the comparison

Identify the user's task, source artifact/version, decision, and output type. Freeze the source. Define meaningful comparison units before requesting independent outputs. Let reviewers use their preferred order while preserving shared unit identifiers.

Examples:

| Task | Comparison units | Display |
| --- | --- | --- |
| Documentation | Opening, example, setup, operating details | Prose, paragraph diff, wording rationale |
| Product plan | Objective, approach, assumptions, risks, validation | Structured prose and tables |
| Architecture | Constraints, boundaries, interfaces, tradeoffs | Markdown, code contracts, evidence links |
| Code alternatives | Implementation, behavior contract, validation cases | Fenced code, exact differences, rationale |

The current renderer supports Markdown and fenced code. Screenshot alignment, visual annotations, interactive diagrams, and patch application require separate adapters; do not claim they are implemented.

## Preserve independent output

Use actual independent reviewers only when the user authorizes them. Preserve raw outputs, reviewer identity, model, source version, and technical evidence. Do not present source-informed lenses as endorsements from real people. Do not fabricate scores or infer quality from agreement.

Use `examples/release-plan.json` and `examples/code-alternatives.json` for the input shape. These are illustrative fixtures, not actual persona runs. Each input has:

- `task`: title, kind, description, source reference, baseline, provenance, named comparison units, optional link base and export filename.
- `reviewers`: stable id, display name, approach, strength, tradeoff, optional exact wording choices, and complete Markdown sections keyed to the task units.

Always provide accurate `task.provenance`. Use a new output directory per comparison to preserve user choices. Reviewer and unit ids must be simple lowercase identifiers. All reviewers cover the same units; units can be omitted explicitly by the user.

## Build and launch

Run from this skill directory with Python 3.9 or newer; no additional packages are needed.

```sh
python3 scripts/create_dashboard.py examples/release-plan.json --out my-comparison
python3 my-comparison/serve.py
```

The server binds to localhost and prints its URL. The HTML embeds its data, styles, and scripts and also works directly as a file. Local server use enables automatic disk saving. Run browser checks appropriate to the task and verify that advertised links and technical claims match source.

## Pull choices directly

The browser automatically posts changed selections after a short debounce. The agent reads `my-comparison/selections.json`, or GETs `/api/selections` at the printed URL. No export, upload, or new model call is needed to retrieve preferences. The agent reads on the next task turn; this is not a background agent notification service.

Interpret:

- `sections`: selected reviewer per unit.
- `omitted`: deliberately excluded units, distinct from undecided units.
- `base`: preferred section order.
- `custom`: user-edited assembled text, authoritative over mechanical reconstruction.
- `snippets` and `notes`: desired wording and explicit instructions.
- `assembledMarkdown`, source revision, and draft hashes: exact selected output and provenance.

Save failures remain visible while browser storage preserves choices. Older timestamps cannot overwrite newer server selections. A previous selection snapshot supports recovery. Export is an optional portable backup.

## Synthesize and apply

Read saved choices immediately before acting. Verify artifact/draft versions and preserve explicit omissions and custom edits. Check mixed outputs for contradictions, duplication, missing dependencies, and technical errors. A selection is a preference, not technical validation. Apply, publish, or deploy only within the user's requested scope, and report these separately.
