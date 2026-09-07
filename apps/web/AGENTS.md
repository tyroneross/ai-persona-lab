# Persona Lab web app

Read the repository root `AGENTS.md` and `docs/repository-consolidation.md`.
Keep Next.js routes in `app/`, UI in `components/`, and server/data logic in
`src/lib/`. The canonical planner and persona schema live at the repository
root. Do not duplicate the plugin here.

From the root: `npm run web:typecheck`, `npm run web:build`, and
`npm run web:smoke`. Set `PERSONA_LAB_HOME` and `PERSONA_COUNCIL_DATA_DIR` to
throwaway directories for mutation tests. Never test against the real library.
