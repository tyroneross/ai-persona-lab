# Choose Lenny podcast perspectives

On the home review workspace, enter the decision in **Review question**. The
Lenny chooser suggests matching responsibilities and explains which terms or
authored aliases matched. Compare each role's question, what it owns, and what
it refers elsewhere. Select the responsibilities that fit your decision.

Use **Browse all roles** or search a role, topic, or speaker when the suggestions
miss the question. A role can share sources with another role. Selection does
not force exclusive professional categories or assume one speaker has only one
specialty. No match means no automatic recommendation.

Expand **Speaker source candidates** to inspect the attributed passages and
optionally choose speaker sources for a selected role. A source must be
explicitly mapped to that role. Choosing a source does not imitate the speaker
or imply their endorsement. A role without a chosen source supplies only its
authored review contract.

The copied brief includes selected questions, responsibilities, referrals, and
chosen source candidates with original-source codepoint locators and hashes.
All stored candidate passages for each chosen source are included. Roles add checklist context within the existing review effort, not additional
reviewer passes. Selections persist in the browser tab alongside the draft.
The chooser does not call a model or write to the saved persona library.

## CLI and agent planner

```sh
persona lenny --select "Review onboarding and pricing for a subscription"
persona lenny --select "Review our API integration docs" --count 3 --json
persona lenny "Nancy Duarte" --json
persona lenny monetization --json
node scripts/persona-plan.mjs "Review onboarding and pricing" --json
```

`persona lenny` browses all matching roles and their source mappings. `--select`
returns a ranked shortlist with reasons; `--count` limits how many results are
returned. The canonical planner includes the same suggestions under
`lennySelection`. Existing professional archetypes, reviewed-principle guests,
CLI encounters and web council rosters retain their existing contracts. The
new source index is separate from the reviewed-principle registry; candidate
passages never silently become reviewed principles or saved personas.

## Scope and evidence

The bundled snapshot comes from the local Lenny podcast persona index dated
2026-09-30: 50 expert review roles and 315 eligible speaker sources. The importer
verified 1,310 candidate passage spans across 323 source files. This is source
integrity evidence, not semantic validation of every mapping or synthetic
review quality. Unresolved voices, source-only roles and advertisement-only
identities are excluded from selectable expert sources.

Transcript excerpts are third-party content owned by Lenny's Podcast and the
respective guests. The source archive's [disclaimer and usage terms](https://github.com/ChatPRD/lennys-podcast-transcripts#license)
state that transcripts are provided for personal and educational use. The
repository's Apache-2.0 license does not grant rights to that third-party text.
Source locators and hashes preserve attribution; they do not establish permission
for additional uses.

The selector uses complete words and phrases from role keywords, names, and
explicit task aliases. Broad aliases such as “evaluate,” “docs,” and “cancel” require relevant domain context. It suppresses matches based only on generic words. The
ranking has no calibrated confidence score: a higher score indicates more
lexical matches, not more competence. Review role boundaries and source context;
add audience, accessibility, domain and specialist perspectives when needed.
The source's authored role boundaries allocate review outputs, not exclusive
human expertise. Preserve source disagreements and missing evidence.

## Refresh the bundled snapshot

From the repository root, with the local transcript repository available:

```sh
node scripts/import-lenny-catalog.mjs --source /path/to/lenny-podcast-transcripts
node scripts/import-lenny-catalog.mjs --source /path/to/lenny-podcast-transcripts --check
```

The importer reads `analysis/persona-library/taxonomy.json` and
`speaker-mappings.jsonl`, verifies their referenced raw source bytes and excerpts
using `original_source_codepoints_v1`, and writes only
`lib/data/lenny-catalog.mjs`. Input file hashes make the projection reproducible.
Neither transcripts nor `PERSONA_LAB_HOME` are modified. Installed packages
include the snapshot and work without the source repository. Refresh requires
the local sources; `--check` reports drift without writing.
