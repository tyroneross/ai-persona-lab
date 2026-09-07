# CLI reference

```bash
persona new "review the onboarding flow for enterprise admins" --count 4
#   selects distinct lenses (>=1 adversarial), emits fill-in scaffolds + a
#   generation prompt + a measurement plan. Add --json for the scaffolds.

persona save persona.json          # validate + persist to the library
persona validate persona.json      # schema check only (exit 1 on failure)

persona list [--tag t] [--role r] [--status s]
persona show <id>
persona search "audit"
persona archive <id>   |   persona rm <id>

persona roster save "Enterprise rollout review" \
  --lenses red-team,buyer,accessibility,novice \
  --personas persona_dana-okoro_57144a1d \
  --use-case "Reviewing a B2B feature before enterprise rollout"
persona roster list | show <name> | rm <name> | lenses

persona panel "review the settings redesign" --level medium
persona panel --roster "Enterprise rollout review" --level high

persona home        # print the library path

# judge the panel after the fact, and reuse what worked
persona run lesson <run_id> --verdict valuable --changed "..." --worked "a;b"
persona run proven                 persona roster from-run <run_id> --name "..."

# what a persona may bring with it (scoped by its role, not your mood)
persona recall <persona_id> [--artifact <slug>] [--project <name>]

# a panel as a durable object you can open months later
persona run new "<question>" --artifact <slug> --version <v> --personas id1,id2
persona run list | show <run_id> | report <run_id> | close <run_id> [--synthesis <file|->]

# what a persona has SEEN — written by the persona before it returns
persona encounter new <persona_id> --artifact <slug> --label ".." --version ".."
persona encounter save <file|->   |  validate <file|->
persona encounter list [<persona_id>] [--artifact <slug>]  |  show <encounter_id>
```

### Encounter memory

`personas.json` holds who a persona is. Encounters hold what it has *seen*. Save encounters before a reviewer returns so the review record survives the
agent session.

`verbatim` is authoritative and never summarised; `findings` are a lossy
extraction kept beside it. `kind` separates a defect from a preference,
`verified` allows `reclassified` (a reported defect is often a silent gate),
`unanswered` carries what a session could not settle into the next dispatch, and
`conditions.viewports` is required. Encounters are append-only.

Contract: [persona memory](persona-memory.md).

The CLI is the deterministic substrate: it owns the library, schema validation,
lens selection, and review planning. Generating persona *content* and running
the review are done by the LLM host (a coding agent, the skill, or Codex), which
calls the CLI to persist and recall. No API key is needed by the CLI.

### Review levels

- `low` — 3-4 lenses, single independent pass. Cheap first look.
- `medium` — 4-6 lenses incl. required red-team, independent passes + synthesis.
- `high` — 6–8 lenses, independent passes + adversarial verification of critical
  findings + measurement rigor.

