# Decision quality in Persona Lab development

Record consequential calls in Build Loop's existing assumption register at
`.build-loop/decisions/<date>-<slug>/register.json`. This is a development record,
separate from persona memories, discussions and council records. Ordinary
reversible implementation details do not require a register or user approval.

Before selecting an execution provider or narrowing a material requirement,
identify the user's intended outcome, the evidence supporting the choice,
alternatives and observable acceptance criteria. Treat contextual hints as
assumptions until evidence supports the interpretation. Keep discussion
coordination and inference-provider decisions separate. Discussion execution
currently supports Luna high and Sonnet high. The checker reuses those tested
profiles; this allowlist does not interpret the user's minimum as forbidding
stronger models. Adding another profile requires separate implementation and
verification.

Use the installed Build Loop `assumption_register.py` commands `new`, `check`
and `build --check`; resolve its plugin root from the installed skill catalog.
Retain the original register schema and human ruling fields. Do not invent a
user pick or confirmation. The generated dashboard is a read-only projection;
records remain usable without it. Shared memory promotion is a separate scope.

Each consequential row adds `assessment` metadata:

```json
{
  "scope": "discussion-execution",
  "capture": "prospective",
  "basis": {
    "kind": "assumption",
    "disclosed": true,
    "evidence": ["Source reference supporting the interpretation or exposing the gap"]
  },
  "outcome": "The concrete user result this decision serves",
  "criteria": ["An observable suitability criterion, beyond recording or parsing output"],
  "execution_profile": "codex:luna-high",
  "verification": {
    "status": "pending",
    "evidence": [],
    "independent_review": {"status": "pending", "evidence": []}
  }
}
```

`basis.kind` is `user-instruction`, `repo-fact`, or `assumption`. References
must identify the actual user statement or source, rather than infer a
requirement from an adjacent phrase. `capture` is `retrospective` for records
created after the decision. Mark that distinction; a post-hoc record is not
proof that preflight happened. Checks on retrospective records emit that warning
even when the current record passes.

Run the base register validator, then:

```sh
npm run decisions:check -- PATH_TO_REGISTER --phase preflight
```

Preflight checks evidence classification, disclosure and outcome criteria. For
rows classified as discussion execution, it also checks supported model profiles.
An independent reviewer must check whether the scope was classified correctly.
Resolve failures by inspecting evidence or testing
the candidate autonomously. Ask the user only when a consequential choice
cannot be resolved from the available evidence; this is not a blanket approval
gate. Do not mark an invented constraint as a user instruction to pass a check.

Before declaring the decision verified, test representative behavior against
the criteria and obtain an independent review of the original requirement,
selected approach and actual evidence. Reconsider the approach when quality
problems emerge. Build, JSON validity and saved turns establish mechanics.
They do not establish the usefulness or accuracy of generated discussion.

```sh
npm run decisions:check -- PATH_TO_REGISTER --phase review
```

The checker validates declared records and the model profile; it cannot attest
that a source supports a conclusion, that output is useful, or that a review
actually happened. The independent reviewer must inspect those claims.

File confirmed incidents with Build Loop's existing retrospective
`file_findings.py plan`, `apply` and `lint` flow. Each finding records what
happened, when, impact, recommendation and why, with a filed location. Link an
incident in its existing register row rather than create another decision store:

```json
{
  "id": "stable-incident-id",
  "detected_by": "user",
  "detected_stage": "after-delivery",
  "status": "resolved",
  "evidence": ["Original decision and correction references"],
  "resolution": ["Fix and regression verification references"],
  "rework_minutes": null
}
```

This object is `assessment.incident`. Detectors are `user`, `self`, or
`independent-review`; statuses are `open` or `resolved`.
`detected_stage` records `preflight`, `review`, or `after-delivery`. Measured time
needs `rework_evidence`; otherwise leave it null. Review rejects open incidents and
resolved incidents without correction evidence. Future findings should remain
distinguishable from preference refinements.

```sh
npm run decisions:report -- PATH_TO_REGISTER [OTHER_REGISTERS...]
```

The report deduplicates decisions by register slug and row ID and counts distinct
incident IDs, separates
prospective from retrospective records, and reports unmeasured rework. It
rejects contradictory copies of a decision or incident. It leaves failure rate and
improvement unavailable because these records do not establish a complete
opportunity denominator or comparable baseline. Compare like decisions and
user-visible outcomes in future evaluations, including the burden of extra
questions. Do not infer improvement from a passing build, an empty detector,
or one corrected incident.

These controls apply to this repository. They do not modify the shared Build
Loop plugin, global agent configuration or existing production persona data.
The dependency-free checker and this guide ship with the existing root scripts
and development guidance. They run only when invoked and do not collect data
or change production model routing.
