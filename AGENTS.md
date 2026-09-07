# Persona Lab

This is the canonical repository for the CLI/plugin and the Next.js web app.

- Root `bin/`, `lib/`, `scripts/`, `schemas/`, `commands/`, `agents/`, and
  `skills/` own the published CLI/plugin. Keep its installation independent
  of web dependencies.
- `apps/web/` owns the app and its lockfile. Its planner uses the root script;
  do not restore a bundled `plugins/persona-lab` copy or a sync writer.
- Persona library records use `PERSONA_LAB_HOME` (default `~/.persona-lab`).
  Council API runs and CLI encounter runs are distinct contracts; preserve both.
- Read `docs/repository-consolidation.md` before moving data or source.
- Check live Rally ownership before shared edits; preserve unrelated work.
- Verify with `npm test`, `npm run web:typecheck`, `npm run web:build`, and
  `npm run web:smoke`. The smoke uses disposable state and no model calls.
- Publishing and deployment remain separate from local consolidation.
