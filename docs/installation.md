# Install and verify Persona Lab

Use the canonical [Persona Lab repository](https://github.com/tyroneross/persona-lab).
The CLI and plugin are at its root; the optional web app is in `apps/web`.

## Prerequisites

- Git, Node.js, and npm on `PATH`.
- Node.js 18 or later for the CLI; Node.js 20.9 or later for the web app.
- A configured coding-agent host to generate personas and execute reviews.
  The CLI itself makes no model calls and needs no model API key.

## CLI from source

In a directory where you keep source checkouts:

```bash
git clone https://github.com/tyroneross/persona-lab.git
cd persona-lab
npm link
persona --help
```

This source path installs the cloned default branch at its checked-out revision;
record `git rev-parse HEAD` for reproducibility. It does not select a published
release automatically.

If the checkout already exists, inspect its branch and local changes before
updating it. `npm link` adds a global `persona` command linked to this checkout;
keep the directory in place. The CLI has no runtime npm dependencies. To avoid
a global link, invoke `node bin/persona.mjs` from the repository root instead.
To remove the global link later, run `npm uninstall -g @tyroneross/persona-lab`.

## Verify without models or personal data

From the repository root, run this in a POSIX shell:

```bash
(
  set -eu
  persona_check_dir=$(mktemp -d)
  trap 'rm -rf "$persona_check_dir"' EXIT
  export PERSONA_LAB_HOME="$persona_check_dir/library"
  persona --help
  persona brief handoff --artifact README.md@local \
    --question "Can a new reader install and verify this tool?" --json \
    > "$persona_check_dir/brief.json"
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const result = JSON.parse(readFileSync(process.argv[1], "utf8"));
    if (result.execution !== "plan-only" || result.model_calls !== 0 || result.writes !== false)
      throw new Error("Unexpected brief execution contract");
    console.log("PASS: CLI produces a review brief without model calls or record writes");
  ' "$persona_check_dir/brief.json"
)
```

Success means exit code 0 and the `PASS` line. This verifies CLI planning; it does
not verify plugin loading or an executed persona review. The shell writes and
removes only its temporary check directory. Real saved personas and encounters
default to `~/.persona-lab`; set `PERSONA_LAB_HOME` to choose another library.

If `persona` is missing, check npm's global bin location on `PATH`, or run the
same checks with `node bin/persona.mjs` in place of `persona`. If a command differs,
inspect `persona --help` and record the checkout's `git rev-parse HEAD`.

## Load the review workflow in your host

For Claude Code versions supporting local plugins, from the repository root:

```bash
claude --plugin-dir .
```

This loads the plugin for that launch. Check `claude --help` for support, then
confirm `/persona-lab:persona-review` is available in the host before requesting
a review. CLI smoke success alone does not establish this.

For Codex, use its plugin installer and a configured marketplace containing
Persona Lab. Inspect `codex plugin --help`, `codex plugin list`, and
`codex plugin add --help` for the installed host's syntax. Marketplace names
depend on the installation. Do not assume Codex accepts Claude's `--plugin-dir`.
Confirm the installed plugin exposes the `persona-lab` and `github-readme` skills;
older published versions may not contain the latter.

An agent with file access can also read [the review skill](../skills/persona-lab/SKILL.md)
or [the README review skill](../skills/github-readme/SKILL.md) directly from this
checkout and execute the instructions without claiming a plugin was installed.
Running a review uses the host's model access and usage allowance. Ask the host
to return its actual reviewers, findings, and saved report path, if one was saved.

## Optional web workspace

From the repository root, with Node.js 20.9 or later:

```bash
npm run web:install
npm run web:dev
```

Open `http://localhost:3000`. The workspace prepares review briefs and manages
personas; preparing a brief does not execute model reviews. Web dependencies
install separately. Council records default to `apps/web/data`; set
`PERSONA_COUNCIL_DATA_DIR` to select another store. Do not start two writers
against one store. Stop the development server with Ctrl-C.

For contributors and agents changing code, read [AGENTS.md](../AGENTS.md).
The verification sequence is `npm test`, `npm run web:typecheck`,
`npm run web:build`, then `npm run web:smoke`. The smoke starts a loopback server
with disposable state and makes no model calls. Deployment is a separate step.
