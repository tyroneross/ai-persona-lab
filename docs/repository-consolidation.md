# Consolidate Persona Lab app and CLI/plugin

Decision: keep one product repository at `tyroneross/persona-lab`, with the
publishable CLI/plugin at the root and the independently buildable Next.js app
under `apps/web`. This reduces drift in the planner and schema without adding
web dependencies to CLI installation. Separate app deployment and CLI package
release remain possible; this is a source consolidation, not a runtime merge.

## Source and recovery

- Persona Lab pre-consolidation main: `6f9f30416b3fd5f3770cb8b869db3075e67a2c98`.
- AI User Personas imported main: `c6ee4cbe72d44b398fdb1b7f0c2c16f93d446d73`.
- Both histories are parents of the consolidation merge; the app is imported
  under `apps/web` without squashing or rewriting source commits.
- Recovery tags: `archive/pre-closeout-2026-09-07/persona-lab-main` and
  `archive/pre-closeout-2026-09-07/ai-user-personas-main`.
- The original AI User Personas checkout, ignored runtime data, installed
  dependencies, and historical refs remain available. They are not removed by
  this change. Use this repository for subsequent development.
- Existing CI branches and the open Persona Lab CI PR are separate work. This
  change does not merge the pending release-guard branch or publish a release.

## Content disposition

All 112 tracked app files were accounted for. The 92 files outside the bundled
plugin were imported under `apps/web`. App UI, APIs, council domain, data
fixtures, council reports, design records, and lockfile remain. Current entry
instructions, deployment instructions, planner path, and smoke script are
updated for their new location.

The 20-file `plugins/persona-lab` copy is represented by the root plugin and
retained in the imported Git history. File-level comparison found:

- The planner and persona-selection reference were byte-identical.
- Root library, roles, schema, encounters, CLI, and reviewer instructions carry
  the newer recall/lifespan, run linking, validation, and evidence behavior.
  They are preserved rather than replaced with the older app copies.
- The council API driver already exists at `commands/run.md`, with additional
  encounter capture guidance. Its web-start instruction now uses this repo.
- The old `feedback` command is retained as an alias to `submit-feedback`.
- Root manifests and package name/version remain authoritative. Older package
  metadata, changelog, README, and memory docs remain in source history.
- `publish-sync.sh` is retired: it exits before any rsync, commit, or push.
- The app persona schema is a symlink to the root schema. App-specific council
  schemas stay in `apps/web/schemas`; they describe different data contracts.

The root `persona run` records encounter panels in the shared library. The
web council API records rosters, assignments, findings, and syntheses in its
own store. Those are intentionally distinct existing contracts. Consolidation
does not silently reinterpret or overwrite either set of records.

## Runtime data and consumers

- Shared personas: `PERSONA_LAB_HOME`, default `~/.persona-lab`, unchanged.
- Web councils: `PERSONA_COUNCIL_DATA_DIR`, default `apps/web/data`.
- The source app's three tracked data files contain empty stores. The imported
  fixtures preserve those exact bytes. Ignored runtime state is not imported.
- If the old app has active council data, set `PERSONA_COUNCIL_DATA_DIR` to its
  existing data directory when starting the consolidated app. Do not run both
  web instances as writers to the same files.
- CLI/plugin consumers continue to use root entry points and the existing
  package name. Local plugin installations pointing into the old app must be
  repointed to this repository before their next refresh. No global plugin
  settings or marketplace caches are silently rewritten here.
- Production starts from the full source checkout via `npm run web:start`, so
  the shared planner remains present. Standalone/serverless packaging is not
  introduced by this change.

## Verification

`npm test` checks the existing CLI contracts and consolidation regressions.
`npm run web:typecheck` and `npm run web:build` check the imported application.
`npm run web:smoke` starts the production server on loopback with fresh temp
stores; verifies the shared planner, CLI-to-web reads, web-to-CLI create/update,
recall preservation, council creation/readback, and five rendered routes; then
stops the server and removes only its temporary stores. It makes no model calls.
CI runs both the CLI suite and the web build/smoke checks.

Before publishing, review the imported history and historical council reports
for the intended repository audience. This local consolidation does not push,
archive the GitHub app repository, deploy, or alter installed plugin caches.

## Local consumer closeout

The installed `persona` binary was discovered pointing into the retired
`AI User Personas/plugins/persona-lab` checkout. The local CLI is relinked to
this canonical repository as part of workspace closeout. Reproduce with
`npm link --force` at the root, then verify `realpath "$(command -v persona)"`.
This replaces the known old CLI link; it does not delete the source checkout
or the persona library. Installed host plugin caches remain versioned host
artifacts; loading this source directly uses `claude --plugin-dir <repo-root>`.
Remote publication and subsequent marketplace updates remain separate.


## Retired repository and local recovery

The former [AI User Personas repository](https://github.com/tyroneross/ai-user-personas)
is archived on GitHub and its README directs readers to Persona Lab. Use this
repository for the app, CLI, plugin, issues, and contributions.

The original local checkout has moved to `archive/AI User Personas` alongside
its former parent directory. The whole checkout, ignored runtime files, local
retirement commit, and historical refs are retained. A verified all-ref bundle,
`archive/AI User Personas-2026-09-07.bundle`, provides additional Git recovery.
The `archive/pre-closeout-2026-09-07/retired-checkout` tag preserves its local tip.
If using that checkout's council data, update `PERSONA_COUNCIL_DATA_DIR` to the
archived location before starting the canonical app. The global persona library
and canonical CLI link are unchanged. GitHub archival is separate from publishing
new Persona Lab versions or deploying the app.
