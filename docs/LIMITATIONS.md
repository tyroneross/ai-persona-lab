# What this method has not earned

Read this before treating anything in persona-lab as established practice.

The rest of this repo is written in a declarative voice — "a first impression is
a non-renewable resource", "blind passes always run first". That voice is a
design stance stated plainly so it can be followed and argued with. It is not a
report of validated findings, and almost none of it has been measured.

If you are an agent that just loaded this plugin: the schemas will be enforced
against you, the CLI will refuse things, and the prose will sound settled. Treat
the enforcement as **this project's opinion, encoded so it stays consistent** —
not as evidence that the opinion is correct.

---

## Provenance of every load-bearing claim

Each row carries a machine-checkable status. `scripts/provenance_lint.py` parses
this table, so keep the shape: `| claim | status | evidence |` where status is
one of `measured`, `single-study`, `borrowed`, `asserted`, and evidence is a
path, a script, or `none`.

| Claim | Status | Evidence |
|---|---|---|
| Encounter memory, blind/informed split, adjudicator role, ask-everything-first, freeze-the-artifact | single-study | encounters/_source-study-2026-08-21/ |
| Subagent eviction at ~30 seconds | asserted | none |
| Persona-lab adoption: 22 plugin vs 335 ad-hoc events across 4,781 transcripts | measured | scripts/persona_usage_audit.py |
| Recall scope defaults across the 16 lenses | asserted | none |
| `none` as the global recall default | asserted | none |
| Panels are for spread, not consensus | single-study | encounters/_source-study-2026-08-21/ |
| A required adversarial lens counters LLM positivity bias | borrowed | none |
| Panel size of 3-6 lenses | asserted | none |
| Blind passes must precede a debate round | asserted | none |
| A preference and a defect need different handling | single-study | encounters/_source-study-2026-08-21/ |
| provenance-lint catches new unbacked claims at ~40-55% precision | measured | scripts/provenance_lint.py |

Notes the table cannot carry:

- **Eviction timing** was observed once in the source study; the `pbe = 30000`
  constant was read from a Claude Code binary that has since changed versions and
  has **not been re-verified**, which is why its status is `asserted` rather than
  `single-study`. The encounter-before-return rule survives on durability grounds
  regardless of the number.
- **The adoption measurement** is the only `measured` row, and it measures
  whether the plugin gets used — not whether the method works.
- **"Panels are for spread"** has a second, independent observation behind it
  (`lenny-podcast-transcripts`, 2026-08-07, 10 personas) but same author and same
  year, so it stays `single-study`.

## Never run in anger

As of 0.7.0 the live library holds **6 personas, 0 encounters, 0 runs**.

Everything added in 0.4.0–0.7.0 — encounter memory, run objects, recall scopes,
outcome lessons — has been exercised only by its own tests. No real panel has
been composed through it end to end. The first genuine run should be treated as
a shakedown, not a result.

## What would actually validate this, and does not exist

These are the gaps that matter most, roughly in order of how much they would
change your confidence.

**1. No calibration against real humans.** Nothing has ever compared a persona
panel's findings to what actual people did with the same artifact. Synthetic
personas could be wrong in a consistent direction — over-indexing on things
models notice, blind to things people trip on — and every control in this repo
would still pass. This is the foundational gap; everything below is secondary.

**2. No baseline.** The method has never been run against a cheaper alternative
on the same artifact: a heuristic checklist, a single strong reviewer, or one
model asked for six perspectives in one pass. "Findings no checklist would have"
is asserted in the method assessment and was never tested against a checklist.

**3. Nothing measures whether personas actually diverge.** Independence is
engineered (separate contexts, no shared transcript) but never verified. Two
personas could return near-identical findings and nothing would flag it. A
simple distinctness metric over encounter findings would catch it.

**4. The adjudicator is un-adjudicated.** `persona-research-adjudicator` sets
`verified: confirmed | refuted | reclassified` and no independent check grades
it. It is an LLM marking an LLM's homework, and it is the exact place a
confident wrong call gets laundered into a "verified finding".

**5. Model tier effects unmeasured.** The 10-persona run was Haiku, the source
study was mixed. Nobody knows whether tier changes what a persona notices. Since
per-persona model assignment is the top unmet feature request, this gap will get
worse before it gets better.

**6. Panel size has no basis.** 3–6 lenses recommended, 10 used once. The numbers
came from judgment, not from a curve of findings versus panel size.

**7. No cost accounting.** Every pass is a real LLM call. Nothing tracks tokens
per run or findings per token, so "was this panel worth it" can only be answered
by feel. `persona run lesson` records a verdict but not a cost.

**8. Encounters have no retention policy.** They accumulate forever. A persona
with `recall: all` and 200 encounters will overflow any dispatch context, and
`buildRecallBriefing`'s `limit` (default 6) silently truncates by recency with no
notion of which memories matter. Recency is a weak proxy for relevance.

**9. The usage-audit classifier is unvalidated.** `persona_usage_audit.py` uses
regex heuristics to split plugin from ad-hoc use. It was hand-corrected once when
it over-counted, but has never been scored against a hand-labeled sample, so its
precision and recall are unknown. Treat its counts as indicative, not exact.

**10. Reconstruction is undetectable.** `permittedEncounters` filters on persona,
artifact, and project with no provenance or age check. A fabricated encounter is
indistinguishable from a real one at recall time. The project's answer is a rule
("never back-fill") rather than a mechanism, and a rule is only as good as the
agent following it. A `provenance` field on encounters would make it structural.

## The provenance lint's own limits

`scripts/provenance_lint.py` enforces the rule at the bottom of this file. It is
subject to that rule too, so: its precision was hand-judged at roughly **40-55%**
over samples from the last 19 commits (`--measure` reproduces the run; the
judging was one person, one pass, ~12 flagged lines).

It stays **WARN-only permanently**. Not "until we tune it" — the residual false
positives are not separable by this approach. Compare two lines it treats
identically:

- "A debate lane cannot precede a blind lane." — method doctrine, unbacked
- "`verbatim` is never discarded, but its pointer is demoted." — a description
  of implemented behavior, checkable by running the code

They are the same sentence shape. Distinguishing them needs to know whether the
statement is about the method or about the tool, which the text does not carry.
Two rounds of tightening moved precision from ~40% to ~50% and then stalled.

So treat a flag as a prompt to ask "is this doctrine or is this behavior", not as
a verdict. A gate at this precision that could block commits would be trained
away inside a week, which is worse than no gate.

The `TABLE` arm is different and is reliable: it checks that every row has a
valid status and an evidence path that resolves on disk. That part is
deterministic and could be made blocking safely.

## What is genuinely solid

Not everything is soft, and over-correcting is its own failure:

- **The adoption measurement** (#3 in the provenance table) is real data over a
  real corpus and reproducible in about 100 seconds.
- **The durability argument** for writing encounters before returning holds
  regardless of the exact eviction timing: a return value that is the only copy
  of the work is fragile for reasons that have nothing to do with 30 seconds.
- **The disagreements the source study surfaced** (experts calling tooltips dead
  weight while novices depended on them) are real observations from that study,
  whatever their generality.
- **The enforcement is consistent.** Whether or not the opinions are right, they
  are applied uniformly rather than remembered unevenly, which is what makes them
  falsifiable at all.

## If you are extending this

Prefer work that closes a gap above over work that adds a feature. The method's
bottleneck is not capability — it is that almost nothing here has been checked.

When you add a claim to the docs, add its provenance to the table above in the
same commit. A claim that enters this repo without one becomes indistinguishable
from a validated finding within about two commits, which is how the current
declarative voice happened in the first place.

```bash
python3 scripts/provenance_lint.py            # staged changes
python3 scripts/provenance_lint.py --measure  # its own precision, on real history
python3 scripts/test_provenance_lint.py
```

It warns; it does not block, and it is not going to. Read a flag as a question —
"is this line doctrine, or is it a description of what the code does?" — and
either add the row or move on.

## September 2026 evidence controls

The CLI can now freeze selected file bytes with Git identity, verify snapshot hashes, generate source-review packets, and retain append-only adjudication and dispatch records. Run attachment checks artifact and roster membership; reports label version-only freezes as declarations and raw verification enums as reviewer assertions. These controls establish traceability and detect inconsistent records, not truth or human calibration.

Dispatch records can retain actual host usage and source locators when supplied. They do not automatically instrument hosts or authenticate a declared receipt; unknown model/usage remains null. Comparing panels against a cheaper reviewer still requires an actual controlled evaluation on the same artifact. Historical zero-run counts above describe the named version only; query `persona run list --json` for the current local library.
