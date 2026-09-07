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

## Build Loop closeout policy

This repository defaults to solo-builder delivery: integrate completed, verified
work into local `main`, commit it, and finish with one canonical checkout. Push
when the user has authorized it. A passing feature branch alone is incomplete.

- Before integration, inspect live ownership, dirty paths, branches, worktrees,
  stashes and upstream divergence. Preserve unique work and recovery refs.
- Verify the final `main` state with all four commands above. Include inherited
  local commits in review before pushing; do not overwrite concurrent changes.
- After integration and positive owner release, archive and remove merged
  temporary branches/worktrees with Build Loop's strict `collapse_run.py`
  workflow. Require verified bundles, terminal receipts and absent refs/paths.
- Give unfinished work an explicit retained or archived disposition with a
  recoverable location. Do not force-delete it to make status appear clean.
- Ignore generated coordination locks; keep current product guidance public and
  archive internal plans and run reports before removing them from the tree.
- Report committed, integrated, clean, pushed and deployed as separate outcomes.

An explicit team/PR workflow overrides solo integration: publish the reviewed
branch and PR, retain the branch until merge or an explicit archive decision,
and follow protected-branch and review requirements. Worktree cleanup still
requires durable work preservation and owner release. Never force-push as cleanup.
