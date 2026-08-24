# Persona memory: the persona is the file, not the process

Written 2026-08-21 after a six-persona study on The Fact Refinery, where five of six planned
follow-up interviews were lost because the agent sessions had already been evicted.

## The failure that forced this

Personas were run as subagents. They reported, then became unreachable. A subagent becomes
eviction-eligible **30 seconds after it finishes** (`pbe = 30000` in the Claude Code binary).
The transcript survives on disk; the ability to reach it does not. There is no supported path
back.

So a persona held in an agent process has a memory measured in seconds.

## The rule that follows

**Persona continuity lives in files. A running agent is a temporary reader of those files,
never the place state is kept.**

Identity already worked this way: `personas.json` holds who a persona is, validated by
`schemas/persona.schema.json`. What was missing is the other half, what a persona has *seen*.
`schemas/encounter.schema.json` adds it.

Both halves live in the **global library**, so a persona recalled from any repo
carries its history with it:

```
~/.persona-lab/personas.json                    who they are, stable
~/.persona-lab/encounters/<persona_id>/*.json   what they met, append-only
```

(`PERSONA_LAB_HOME` overrides the root. This repo's `encounters/` directory holds
the source study that produced this document, not the live store.)

The CLI owns both:

```bash
persona encounter new <persona_id> --artifact <slug> --label "<label>" --version "<v>"
persona encounter save <file|->      persona encounter validate <file|->
persona encounter list [<persona_id>] [--artifact <slug>]
persona encounter show <encounter_id>
```

`persona encounter save` refuses an `encounter_id` it has already recorded.
Encounters are append-only; a second look is a second encounter.

## The contract every persona session follows

**On start**, load your identity from `personas.json`. Then decide, deliberately, whether to
load your own prior encounters:

- **Blind** when you want an unanchored reaction. Set `blind: true`, leave
  `prior_encounters_shown` empty. Use this to ask "does this work", and for any first look at
  a new artifact.
- **Informed** when you want to know whether something improved. Load specific
  `encounter_id`s and list them. Use this only to ask "is this better than before".

Never mix the two silently. A persona given its own prior answers will rationalise a position
it never held, which is why an informed read cannot substitute for a blind one.

**On finish**, write the encounter file *before returning*. The return value should be a
pointer to that file, not the only copy of the work. Thirty seconds is not enough time to
decide later.

## What the encounter record must carry

`verbatim` is authoritative and is never summarised. Structured `findings` are a lossy
extraction from it, kept so the record stays checkable against what was actually said.

Three fields matter more than they look:

**`kind`** separates a defect from a preference. A slider that will not move is a defect.
Disliking a metaphor is a preference. Conflating them is the most common analysis error in
this kind of study.

**`verified`** exists because participants are often wrong about causes. In the study that
produced this document, three of four controls reported as broken were not broken. They were
gated, and every gate was silent. A reviewer reading the code found that; asking the
participants again would have confirmed the symptom and missed it. So a reported defect can
be `reclassified`, not only confirmed or refuted.

**`unanswered`** is the direct fix for the failure above. Anything a session could not settle
gets recorded so the *next* dispatch asks it up front, rather than assuming a follow-up turn
that may not exist.

**`conditions.viewports`** is required because a finding without a viewport is not a finding.
Half of the study's real defects appeared only at phone width.

## Composition, unchanged

Panels are for spread, not consensus. Compose for the widest range of viewpoints, allow
overlap, and never force MECE segmentation onto the roster. Report each persona side by side
and keep disagreements visible. Two of the study's most useful results were disagreements:
experts called the glossary tooltips dead weight while novices depended on them, and three
participants wanted a section deleted that three others named the best evidence on the page.

Collapsing either into a panel view would have destroyed the finding.

## Running a study

1. **Freeze the artifact.** Snapshot it and record `artifact.version`. Builder edits racing
   participant sessions produce findings about a page that never existed.
2. **Ask everything in the first dispatch.** There is no reliable second turn.
3. **Run blind by default.** Compare rounds at the analyst level, where both are visible,
   rather than by showing a persona its own history.
4. **Have each persona write its encounter before returning.**
5. **Verify defects against the artifact** before treating any as real.
