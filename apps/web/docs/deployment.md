# Running Persona Lab web

Run from the persona-lab repository root:

```bash
npm run web:install
npm run web:dev
# Production, from a full source checkout:
npm run web:build
npm run web:start
```

The app remains a local filesystem application. Its shared planner executes
`../../scripts/persona-plan.mjs` from the web working directory. Root npm
commands set that directory through `npm --prefix apps/web`.

Personas use `PERSONA_LAB_HOME` or `~/.persona-lab`; council records use
`PERSONA_COUNCIL_DATA_DIR` or `apps/web/data`. Set both to disposable locations
for tests. `npm run web:smoke` does this automatically and never calls a model.
No hosted deployment or data migration is implied by consolidating source.
