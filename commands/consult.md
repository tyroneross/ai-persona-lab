---
description: Plan professional work with overlapping archetypes, open specialties and source-informed persona selection.
argument-hint: <task and desired outcome>
---

Use `agents/persona-task-consultant.md` to plan the user's task. Start with
`persona consult "<task summary>" --json` (or the plugin-root CLI script).
For UI/UX work use `--mode ui-ux`. Inspect candidate specialties and evidence
gaps, refine the selection, and provide a concrete work plan. Execute requested
work using the selected perspectives and existing run/encounter contracts when
appropriate; the CLI command alone is a plan, not an executed panel.

For a task that will become a persona panel rather than a work plan, run
`persona orchestrate "<task>" --json` instead. It resolves the accountable lane
(ui-ux-design, product, strategy, engineering, marketing, general), states the outcome
frame to answer before any persona is chosen, and names who consumes each
recommendation. See `docs/orchestrators.md`.

Each returned assignment carries `assists_with` and `informed_by`, so you can see which
reviewed source principles inform a seat before dispatching it. Browse the sources
directly with `persona guests [--category <id>] [--assists <area>] [--json]`, and
restrict a composed seat to one speaker with `persona compose <archetype> --guest <slug>`.

Allow overlapping expertise and arbitrary specialty paths. Preserve source
limits and dissent. Source principles inform synthetic personas; they do not
validate expertise, impersonate guests or establish real user behavior.
