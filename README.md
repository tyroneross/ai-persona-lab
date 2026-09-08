# AI Persona Lab

Launch synthetic personas to review your app UI/UX, architecture, and code base before you deploy

AI Persona Lab helps your coding agent examine a feature, interface, README, or plan from several relevant perspectives. Each reviewer works independently, then the agent brings together the findings, disagreements, and open questions. You receive a focused set of issues to investigate, changes to consider, and questions to test with real users.

Start with one artifact and one decision you need to make. The review is most useful when you name the intended users and the evidence you want back.

## See one decision from three sides

After [installing or loading the workflow](docs/installation.md), give your coding agent a request like this. Replace the path with an artifact that exists:

```text
Use AI Persona Lab to review docs/proposed-onboarding.md.
The users are first-time workspace admins. We need to decide whether to require
teammate invitations during setup. Review the current file with three independent
perspectives: a first-time admin, an experienced admin, and a skeptical buyer.
Use one pass each and no prior review history. Return the obstacles, disagreements,
recommended changes, and questions we should check with real users.
```

The host asks each perspective to review the same artifact separately, then synthesizes the findings without hiding disagreement.

An **illustrative output**, not a measured result:

| Perspective | Possible finding | Next check |
| --- | --- | --- |
| First-time admin | “I want to see the workspace before inviting my team.” | Observe where new admins hesitate. |
| Experienced admin | “Bulk invites matter more than a guided setup.” | Check whether larger teams need a separate path. |
| Skeptical buyer | “Mandatory invites could expose an evaluation before approval.” | Ask buyers how trials get authorized. |

The realization is practical: making invitations optional may be worth considering, but the reviews have identified a hypothesis, not proved the answer. Real-user research determines whether the change helps.

## Install and verify

Give your installing agent this handoff:

```text
Set up AI Persona Lab from https://github.com/tyroneross/ai-persona-lab.
Read README.md, AGENTS.md, and docs/installation.md. Use the existing checkout
if present, preserving local changes. Install the CLI and run the documented
model-free check with disposable state. Load the review workflow in my current
host, or report the exact host setup gap. Report the source revision, checks run,
state created, and whether a real review ran. Start the web app only if requested.
```

[Installation and verification](docs/installation.md) provides prerequisites, exact commands, expected output, host setup, storage details, and recovery steps.

## Understand what runs where

| Goal | Entry point | Responsibility |
| --- | --- | --- |
| Execute persona reviews | Claude Code or Codex host | Reads the artifact, uses the host's models, and returns findings. |
| Plan and preserve reviews | `persona` CLI | Creates plan-only briefs and stores personas, rosters, encounters, and reports. It makes no model calls. |
| Prepare a review visually | [Web workspace](docs/review-workspace.md) | Selects profiles and prepares a brief; it does not execute model reviews. |

The CLI, plugin, and web app share this repository, while their installation and state remain distinct. CLI installation does not install web dependencies. The CLI persona library defaults to `~/.persona-lab` and can be moved with `PERSONA_LAB_HOME`. Web council records default to `apps/web/data` and can be moved with `PERSONA_COUNCIL_DATA_DIR`; do not run two writers against one store.

Saved personas, rosters, and encounters let you reuse a perspective or revisit a review. The review brief and the persona's permitted scope control recall. A CLI smoke check proves plan generation only; confirm that the host loaded the workflow before treating a review as executed.

## Explore the capabilities

- [CLI reference](docs/cli.md): generate, save, recall, and plan reviews.
- [Professional archetypes](docs/archetypes.md): compose specialty perspectives and inspect the source evidence informing consultation plans.
- [Persona memory](docs/persona-memory.md): understand identity, recall, and encounter contracts.
- [Review workspace](docs/review-workspace.md): prepare a bounded product-decision, interface, or handoff review.
- [Agent workflow](skills/persona-lab/SKILL.md): select reviewers and execute the workflow.

## Contribute or get help

[Open an issue](https://github.com/tyroneross/ai-persona-lab/issues) with the command or workflow, source revision, expected result, and actual result. Remove private artifacts and credentials. For code changes, read [AGENTS.md](AGENTS.md) and run the documented verification commands before opening a pull request.

Built by [RossLabs](https://rosslabs.ai). The [package metadata](package.json) declares Apache-2.0. The package is `@tyroneross/persona-lab`; the plugin identifier is `ai-persona-lab`.

## Method notes

Synthetic personas produce review hypotheses, not validated user research. Their findings depend on the artifact, brief, selected perspectives, permitted recall, and host model. Separate reviews preserve useful disagreement, but they still require synthesis and real-user validation. See [method limits](docs/LIMITATIONS.md) for the evidence behind the approach.
