---
name: persona-output-comparison
description: Build a task-adapted dashboard for comparing independent persona outputs, selecting useful parts, and letting an agent read the user's saved choices directly.
---

# Decision Studio comparison

Use Decision Studio to compare alternatives for a user-defined decision and save
what the user chooses. README review is one optional template. The same workflow
supports UI/UX findings, other writing, code, plans, and custom decisions.

The optional [studio setup module](../../modules/decision-studio/README.md)
collects the task, artifact references, reviewer roles, and comparison units.
Keep task-specific templates separate from the shared comparison renderer.

## Establish the comparison

Identify the user's task, source artifact/version, decision, and output type.
Ask the user to choose reviewer roles and edit their briefs before launching
reviews, unless the current task already contains that choice. Offer relevant
roles as suggestions with none selected automatically. Use role names such as
communications editor or accessibility reviewer. Named-person lenses require
an explicit user request.

Freeze the source. Define comparison units around the decision: passages for
writing, screens and findings for UI/UX, contracts for code, or criteria for
custom alternatives. Let reviewers use their preferred order while preserving
shared unit identifiers. Keep evidence, assumptions, and tradeoffs visible.

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

The browser automatically posts changed selections after a short debounce. The agent reads `my-comparison/selections.json`, or GETs `/api/selections` at the printed URL. No export, upload, or new model call is needed to retrieve preferences. The agent retrieves the saved record on the next task turn.

Interpret:

- `sections`: selected reviewer per unit.
- `omitted`: deliberately excluded units, distinct from undecided units.
- `base`: preferred section order.
- `custom`: user-edited assembled text, authoritative over mechanical reconstruction.
- `snippets` and `notes`: desired wording and explicit instructions.
- `assembledMarkdown`, source revision, and draft hashes: exact selected output and provenance.

Save failures remain visible while browser storage preserves choices. Older timestamps cannot overwrite newer server selections. A previous selection snapshot supports recovery. Export is an optional portable backup.

## Synthesize and apply

Read saved choices immediately before acting. Verify artifact/draft versions and preserve explicit omissions and custom edits. Check mixed outputs for contradictions, duplication, missing dependencies, and technical errors. Validate technical claims separately from the user’s wording preferences. Apply, publish, or deploy only within the user's requested scope, and report these separately.

## Edit authored copy

Use direct verbs and concrete claims. Remove repeated framing, inflated benefits,
ceremonial transitions, rhetorical “not X but Y” constructions, and em dashes
from newly authored prose. Review meaning before editing. Preserve exact source
quotations, code, commands, user text, and original reviewer outputs in the
comparison record; label editorial revisions.
