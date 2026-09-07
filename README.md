# AI Persona Lab

Launch synthetic personas to review your app UI/UX, architecture, and code base before you deploy

AI Persona Lab gives your coding agent distinct perspectives to review a feature,
interface, README, or plan, then brings their findings and disagreements together.
You get issues to investigate, changes to consider, and questions to take to real users.

## Try a review

After [installing or loading the workflow](docs/installation.md), give your coding
agent a request like this. Replace the example path with an existing artifact
you want reviewed:

```text
Use AI Persona Lab to review docs/proposed-onboarding.md.
The users are first-time workspace admins. We need to decide whether to require
teammate invitations during setup. Review the current file with three independent
perspectives: a first-time admin, an experienced admin, and a skeptical buyer.
Use one pass each and no prior review history. Return the obstacles, disagreements,
recommended changes, and questions we should check with real users.
```

The host reads the artifact, executes the separate reviews, and synthesizes them.
The CLI prepares plans and stores records; it does not call models. Saved personas,
rosters, and encounters let you reuse a perspective or revisit a past review, with
recall controlled by the review brief and the persona's permitted scope.

An **illustrative output**, not a measured result:

| Perspective | Possible finding | Next check |
| --- | --- | --- |
| First-time admin | “I want to see the workspace before inviting my team.” | Observe where new admins hesitate. |
| Experienced admin | “Bulk invites matter more than a guided setup.” | Check whether larger teams need a separate path. |
| Skeptical buyer | “Mandatory invites could expose an evaluation before approval.” | Ask buyers how trials get authorized. |

The synthesis keeps those differences visible and identifies what remains
unverified. A proposed change might be to make invitations optional; actual user
research would determine whether that helps.

## Get started

Give your installing agent this handoff:

```text
Set up AI Persona Lab from https://github.com/tyroneross/ai-persona-lab.
Read README.md, AGENTS.md, and docs/installation.md. Use the existing checkout
if present, preserving local changes. Install the CLI and run the documented
model-free check with disposable state. Load the review workflow in my current
host, or report the exact host setup gap. Report the source revision, checks run,
state created, and whether a real review ran. Start the web app only if requested.
```

[Installation and verification](docs/installation.md) covers prerequisites,
commands, host setup, expected output, storage, and recovery.

| Use | Entry point | What it does |
| --- | --- | --- |
| Ask an agent for feedback | Claude Code / Codex workflow | Executes persona reviews using the host's models. |
| Manage reusable perspectives | `persona` CLI | Plans reviews and saves personas, rosters, encounters, and reports. |
| Prepare a review visually | [Web workspace](docs/review-workspace.md) | Selects profiles and prepares a brief for an agent to execute. |

The app, CLI, and plugin share this repository. CLI installation does not install
web dependencies. The default persona library is `~/.persona-lab`; web council
records use a separate store. [Storage and setup details](docs/installation.md).

## Review a GitHub README

Use the [GitHub README skill](skills/github-readme/SKILL.md) to assess whether a
person can understand the benefit and an agent can install and verify the tool:

```text
Use the github-readme skill to review this repository's README with three
independent perspectives: a new user, an installing agent, and a skeptical adopter.
Recommend changes to the opening, example, and installation path. Keep the raw
reviews separate from the synthesis and verify technical claims against source.
```

The skill checks problem, approach, useful output, setup, and proof of a first
result. It supports review-only requests and authorized rewrites.

## Explore the capabilities

- [CLI reference](docs/cli.md): generate, save, recall, and plan reviews.
- [Professional archetypes](docs/archetypes.md): compose specialty perspectives
  and inspect the source evidence informing consultation plans.
- [Persona memory](docs/persona-memory.md): identity, recall, and encounter contracts.
- [Review workspace](docs/review-workspace.md): prepare a bounded handoff,
  interface, or product-decision review.
- [Agent workflow](skills/persona-lab/SKILL.md): reviewer selection and execution.

## Contribute or get help

[Open an issue](https://github.com/tyroneross/ai-persona-lab/issues) with the command
or workflow, source revision, expected result, and actual result. Remove private
artifacts and credentials from reports. For code changes, read [AGENTS.md](AGENTS.md)
and run the documented verification commands before opening a pull request.

Built by [RossLabs](https://rosslabs.ai). The [package metadata](package.json) declares Apache-2.0.
The package is `@tyroneross/persona-lab`; the plugin identifier is `ai-persona-lab`.

## Method notes

These are synthetic review hypotheses, not validated user research.
See [method limits](docs/LIMITATIONS.md) for the evidence behind the approach.
