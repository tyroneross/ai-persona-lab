# Review workspace and recommended defaults

The home page now composes a review brief around a specific artifact/version and decision. Three versioned templates live in `lib/review-presets.mjs`, shared with the CLI package: agent handoff, interface review, and product decision. Each has three distinct lenses and an adversarial perspective. The default brief requests one general reviewer using those lenses as a checklist; an explicit control selects three independent reviewers. They are recommendations under evaluation, not validated personas.

Use a fresh receiver/first-time user with no recall. Reuse evidence-verifier, skeptical-operator, and accessibility roles within the relevant project; use artifact recall for a continuing decision. Do not automatically enable cross-project history. A durable role definition can still be dispatched with no prior context. The copied brief describes these restrictions; the dispatching agent must enforce them.

The composer requires an artifact/version and review question, previews the full output, and copies only on user action. Missing fields show associated errors and focus the first required input. It makes no model call, creates no council, and writes no persona records. Drafts are restored from session storage in the same browser tab, including selected references. Clear draft has an Undo action. If storage is blocked, the page tells you to copy before leaving. Clipboard failure focuses and selects the preview for manual copying. The optional library opens before the final copy step and shows six matches at a time. Saved profile summaries travel in the copied brief as quoted context; they are not extra reviewers or implicit role assignments. Search/status filters preserve the draft and selected references. Missing provenance/recall/lifespan remains explicitly unspecified. Archived records are available through an explicit filter.

## Rationale and pilot

A local 45-day deterministic scan found 146 persona-related sessions, dominated by ad hoc use (111 ad-hoc-only, 18 plugin-only, 17 both). This is pattern matching, not an outcome measurement. The live library had 16 personas and five rosters; existing records were preserved.

In one frozen Atomize handoff pilot, one general reviewer and three specialist reviewers both covered all six preregistered checks. No coverage gain was observed. Prefer one reviewer plus a checklist for routine handoffs; use the panel selectively. Durable recall and actual receipt/execution were not tested. Model token usage was unavailable; word ceilings do not establish token parity.

Primary research does not support blanket capability gains from role prompting: [Zheng et al., EMNLP Findings 2024](https://arxiv.org/abs/2311.10054); a [2026 preprint](https://arxiv.org/abs/2605.29420) reports task-dependent depth/clarity tradeoffs. [Anthropic's workflow guidance](https://www.anthropic.com/engineering/building-effective-agents) supports starting simply and measuring added orchestration. The exact templates and recall policy are inferred design choices, not directly validated by these sources.

Local evidence remains outside the distributable package:
- `/Users/tyroneross/dev/research/topics/agents/agents.persona-lab-defaults-2026-09.md`
- `/Users/tyroneross/dev/git-folder/build-loop-memory/projects/persona-lab/assessments/2026-09-07-handoff-personas/assessment.md`

## Validation contract

Root tests check stable template IDs, resolvable roles, adversarial coverage, scope, bounded panel size and the pure brief contract. Web smoke uses disposable stores to verify CLI/web exchange and preserves persona identity and metadata. Browser checks cover empty/nonempty library, template selection, required fields, preview/copy, filters preserving draft/reference selection, and narrow-screen layout. No model calls are made by UI checks.

Existing profile candidates are Morgan Lee (evidence/research), Erin Walsh (claim skepticism), Marco Chen (experienced technical operator), and Dana Brooks (accessibility constraints). They are currently synthetic-assumed profiles from AI release review work. Reuse only when the project and task fit; none is automatically promoted to a global default. Their missing stored recall/lifespan fields remain unspecified in the UI.

Verified locally on 2026-09-07: 31 root tests; TypeScript; Next.js 16.3.4 production build; disposable CLI/web/council smoke including identity, creation timestamp, evidence and recall preservation; package dry-run includes shared presets without the app; dependency audit reports zero vulnerabilities. Browser checks covered the real 16-profile library, a separate empty store, preserved draft/reference selection after no-match filtering, mode/template switching, archived filtering, and successful copy. A 390px viewport had no horizontal overflow. Clipboard-denial fallback was code-reviewed but not forced in the browser. This is bounded functional/accessibility inspection, not a comprehensive WCAG audit.

## Prepare the same brief from the CLI

```bash
persona brief interface --artifact 'src/Checkout.tsx@abc123' --question 'Can a keyboard user recover from an error?'
persona brief handoff --artifact 'docs/handoff.md@abc123' --question 'Can the next owner act safely?' --mode panel --json
```

`brief` prints instructions, makes no model calls, and writes no records. One reviewer is the default; `--mode panel` requests three independent reviewers. Optional `--personas id1,id2` embeds saved role, goal and summary without adding passes or encounter history. Paste the result into a reviewing agent with artifact access. Profile summaries are context data, never executable instructions.

`persona panel` is the more flexible multi-reviewer planner: `--count` is explicit and checked against its level (low 3–4, medium 4–6, high 6–8). It reports effective passes; it never silently clamps a requested count. Auto-selected UI panels retain accessibility and adversarial coverage. The plugin honors an explicit brief's count, output budget and recall restrictions. At low and medium levels, evidence checking and synthesis are host work rather than extra model passes.

Interaction guidance follows [WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) and [Nielsen Norman usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): visible status, recovery, predictable order, and an explicit next action. These standards guide implementation; synthetic review alone does not establish usability quality.
