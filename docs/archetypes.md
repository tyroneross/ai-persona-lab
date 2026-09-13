# Professional archetypes with composable specialties

Persona Lab now separates three things: the professional expertise a task needs,
the perspective used to critique it, and the source evidence available to inform
that perspective. A marketer and an engineer can share hardware expertise. A
founder can also be an operator and communicator. These overlaps are useful.

The catalog is deliberately expansive, not MECE. Five navigation defaults—
consultant, product leader, engineer, designer and red-team—provide a short
starting point. The complete set currently contains 24 archetypes spanning
leadership, building, marketing, sales, research, investing, communication,
coaching, operations and other professional work. Defaults and role practices
are authored design choices, not a measured optimum. Existing novice, buyer,
accessibility and other critique lenses continue to work.

## Compose expertise

An archetype is a stable ID from `lib/data/archetypes.json`. A specialty is an
open path of slugs; paths have no fixed depth or enumerated vocabulary. Multiple
paths can be combined without forcing them into one hierarchy.

| Composition | Example |
|---|---|
| Marketer + function + product domain | `marketer` with `product-marketing,hardware/networking` |
| Marketer + software business model | `marketer` with `product-marketing,saas/b2b` |
| Engineer + technology | `engineer` with `hardware/silicon/verification` |
| Investor + business model + vertical | `investor` with `venture-capital,vertical-saas/healthcare` |
| Coach + communication context | `coach,communicator` with `public-speaking,executive-communication` |
| Designer + interaction domain | `designer,researcher` with `interaction-design,industrial-software` |

The examples describe requested expertise. They do not imply that the corpus
supplies evidence for every specialty. Unknown paths work immediately and
appear in `evidence_gaps`. For a nested path, all segments need support in the
same reviewed principle before that path is marked covered. Even a covered
path means a relevant principle was found, not that a synthetic persona is
qualified to perform the work. Adding a new top-level archetype requires an
explicit catalog edit with its goal, practices, limits and lens; adding a
specialty requires no catalog or schema change.

```bash
persona archetypes --defaults --json
persona archetypes investor --json
persona compose marketer --specialties product-marketing,hardware/networking --json
persona compose coach,communicator --specialties public-speaking --save
```

Composition returns `{persona, principles, evidence_gaps}`. `--save` persists
the draft; without it, composition is read-only. To persist later, extract the
`persona` object and pass it to `persona save`. Existing records are never
automatically relabelled. Each saved record has optional `composition` metadata:
version, archetype IDs, specialty paths, and references to its own evidence IDs.
CLI search includes this metadata. Web edits preserve it even when an older
form omits the field. The web UI still uses its existing persona list/editor;
there is no new visual taxonomy browser in this change.

## Let an agent select a team

```bash
persona consult "Plan an accessible onboarding flow" --mode ui-ux --json
persona consult "Prepare a networking hardware product launch" \
  --archetypes marketer,engineer --specialties product-marketing,hardware/networking
persona consult "Evaluate a healthcare vertical SaaS venture investment" --json
```

`consult` returns a machine-readable planning packet with selection reasons,
saved persona matches, new drafts, source principles, evidence gaps, recall
requirements and launch steps. Default selection is a deterministic keyword
heuristic; automatically detected specialties are labelled `keyword-candidates`.
An agent should refine them against the actual decision. `--archetypes` and
`--specialties` make that choice explicit. `--count` supports 3–8 perspectives,
including a challenger. The UI/UX mode prioritizes design, research, engineering
and accessibility. It is a roster planner, not an automatic model runner.

A saved persona can occupy only one seat. Reuse requires a matching archetype
and every requested specialty path. Source coverage comes from evidence
attached to that record, not from evidence elsewhere in the catalog. The plan
includes the complete source principles and limits again when a saved persona
is reused. Supply `--artifact` or `--project` for scoped recall; otherwise the
packet names the missing scope instead of emitting a misleading recall command.

The host-neutral entry points are `commands/consult.md` and
`agents/persona-task-consultant.md`; the main skill routes professional tasks
to them. The host can run independent persona agents after selecting the team,
using the existing encounter/run workflow or the separately defined council
API. The CLI itself does not spawn agents, call models, or write encounters.
Transcript knowledge is background evidence. It is never a fabricated encounter
and does not permit bypassing first-use or scoped recall rules.

## Lenny's Podcast guest registry

`lib/data/lenny-guests.json` makes the reviewed speakers first class. Before it, a guest
was implicit: you could read a principle and see who said it in `source.speaker`, but you
could not ask "who informs a positioning seat" or "which areas does this source actually
cover".

```bash
persona guests [query] [--category <id>] [--assists <area>] [--json]
persona compose engineer --guest will-larson --json     # only this speaker's principles
persona list --assists positioning                      # saved personas by area
```

| Guest | Expert category | Assists with |
|---|---|---|
| April Dunford (`april-dunford`) | positioning-and-marketing | b2b-saas, category, differentiation, messaging, positioning, product-marketing, sales-narrative, target-account-profile, technical-marketing |
| Brian Halligan (`brian-halligan`) | executive-hiring-and-org-design | executive-hiring, organizational-scaling, senior-hiring-process, stage-fit |
| Chip Huyen (`chip-huyen`) | ai-and-ml-products | agent-orchestration, ai-evaluation, ai-products, information-retrieval, retrieval |
| Claire Hughes Johnson (`claire-hughes-johnson`) | operations-and-scaling | coaching, feedback, leadership-development, mission-and-strategy, operating-cadence, organizational-scaling, planning |
| Jason Lemkin (`jason-lemkin`) | saas-and-go-to-market | b2b, b2b-saas, churn, go-to-market, investment-thesis, product-led-growth, retention, roadmap-planning, saas, sales-motion, sales-product-collaboration, self-service, technical-sales, venture-capital |
| Julie Zhuo (`julie-zhuo`) | design-leadership | agent-orchestration, customer-research, design-review, experimentation, interaction-design, product-analytics, team-design |
| Kim Scott (`kim-scott`) | management-and-feedback | feedback, people-management |
| Marty Cagan (`marty-cagan`) | product-leadership | product-discovery, product-strategy, usability-testing |
| Matt Abrahams (`matt-abrahams`) | communication-and-presenting | deliberate-practice, executive-communication, interviewing, public-speaking |
| Sarah Tavel (`sarah-tavel`) | investing-and-market-timing | consumer-products, diligence, early-stage, market-thesis, market-timing, marketplaces, retention, venture-capital |
| Teresa Torres (`teresa-torres`) | product-discovery-and-research | b2b-saas, continuous-discovery, customer-research, discovery-interviews, interaction-design, product-strategy, usability |
| Tony Fadell (`tony-fadell`) | hardware-and-product-building | agent-orchestration, commercialization, deep-tech, deep-tech-investing, diligence, hardware, hardware-software-integration, usability-testing |
| Will Larson (`will-larson`) | engineering-leadership | engineering-management, engineering-strategy, infrastructure, platform-direction, product-strategy, software-platforms |

`assists_with` is derived from that guest's own principles and is checked by test: every
area must either appear in one of the guest's `specialties` or be present in the text of
its own principles. `archetypes` must equal the union across those principles. Coverage is
asserted in both directions — every `source.speaker` in the evidence files has a registry
entry, and every `principle_ids` entry resolves to a principle that speaker actually said.

### Expert categories

| Category | What it covers |
|---|---|
| `positioning-and-marketing` | Naming the alternative a buyer actually considers, and saying why the product is different. |
| `product-discovery-and-research` | Turning an outcome into a justified feature choice through continuous customer contact. |
| `product-leadership` | Covering the risks a product proposal carries across value, usability, feasibility and viability. |
| `engineering-leadership` | Writing an engineering strategy people can act on, and holding a technical standard. |
| `ai-and-ml-products` | Evaluating AI systems on their weak cases rather than their demos. |
| `design-leadership` | Connecting observed behaviour to design options, and reconciling data with what users say. |
| `saas-and-go-to-market` | Matching the commercial motion to how the buyer wants to buy, and defending retention. |
| `hardware-and-product-building` | Making coupled physical and software components usable as one thing. |
| `communication-and-presenting` | Structuring an update, an answer, or a practice loop so the audience can act. |
| `management-and-feedback` | Making feedback a dialogue about specific behaviour rather than a verdict about a person. |
| `operations-and-scaling` | Giving a growing organisation a cadence and written decisions it can rely on. |
| `investing-and-market-timing` | Judging durable usage and market change rather than market size alone. |
| `executive-hiring-and-org-design` | Hiring for the stage the company is in rather than for prestige. |


### What this is not

A guest entry indexes a public transcript. It is not endorsement, not proof of competence,
and never a licence to impersonate. A composed persona records `informed_by` (which guests,
which exact principle ids) and `assists_with` (the areas those principles support, narrowed
to the archetypes in play), and is named for its lens — "Marketer — positioning" — never for
the person who said them. A test asserts no composed persona from any archetype carries a
guest's name.

### Adding a guest

1. Add the reviewed principles to `lib/data/lenny-product-evidence.json` or
   `lib/data/lenny-leadership-evidence.json`, each with speaker, source-relative path,
   SHA-256, and inclusive line range.
2. Add the registry entry to `lib/data/lenny-guests.json`: `slug`, `name`,
   `expert_category` (from the enumerated set above), `assists_with`, `archetypes`,
   `principle_ids`, `source_note`.
3. Run `npm test`. Coverage, category, assists-with support and archetype union are all
   asserted; a speaker with no registry entry fails, and so does a registry entry claiming
   a principle that does not exist.
4. Run `persona sources verify --root <corpus-root>` when the corpus is available locally,
   to confirm the line spans and hashes still resolve.

## Corpus ingestion and reviewed evidence

The local source is `lenny-podcast-transcripts/transcripts/raw`. It already had
333 preserved transcripts, a checksum manifest, a catalog, graph projections,
and a reasoning ledger. A pre-existing six-persona Lenny roster reviewed the
corpus product; it was not a collection of transcript-grounded professionals.
The audit records what was checked and where searches were bounded.

This change indexes every manifest entry without copying raw transcripts and
adds 40 source-grounded principle records from 13 reviewed interviews. Two
miners reviewed selected passages and their context. This is not a semantic
review of all 333 episodes. Each principle preserves speaker, source-relative
path, SHA-256, inclusive line range, paraphrased principle, when to use it, and
when not to apply it. A principle is an interpretation of an interview, not a
general law, guest endorsement, or simulation of that guest.

```bash
persona sources scan --root /path/to/lenny-podcast-transcripts
persona sources ingest --root /path/to/lenny-podcast-transcripts
persona sources search "positioning"
persona sources principles
persona sources verify
```

`scan` verifies the manifest and returns a deterministic index.
`ingest` stores that index and source locator under
`$PERSONA_LAB_HOME/sources/lenny-podcast.json` (default `~/.persona-lab`). Repeating
ingestion with unchanged source bytes leaves the index unchanged. Hash mismatch,
duplicate manifest entries, source escape and unmanifested raw files prevent
ingestion. `search` reads and verifies local transcript bytes, then returns
lexical candidate matches and line locators. Matches are not automatically
promoted into reviewed principles. `verify` checks hashes and line boundaries
for the curated principles; it cannot verify the semantic judgment itself.

The corpus supports useful starting material in leadership, communication,
coaching, positioning, product, research, engineering management and investing.
Tony Fadell contributes hardware/software integration and commercialization
principles. It does not yet establish silicon-design competence, networking
engineering depth, or sector-specific vertical SaaS investment judgment.
Those require additional primary material and specialist review.

To extend the seed, locate candidate passages, read the speaker and surrounding
context, record counterexamples and applicability, add a reviewed evidence
record, and run source verification. Do not turn keyword matches, sponsor copy,
closing jokes, or a guest's job title into expertise claims. Numeric confidence
settings in composed personas are authored estimates, not calibrated scores.

Package distribution includes catalog and principle data under `lib/`; Next.js
dependencies and raw transcript content remain outside the CLI package.
Local implementation, library ingestion, package publication and deployment are
separate operations.
