# Group discussions

Open **Discussions** in the Persona Lab web app. Choose at least two saved
personas or Lenny role lenses, enter a topic, goal, and evidence, and create a
room. Creation saves the setup without inference. Select **Run / resume** to
record the conversation, or **Record next turn** to inspect each response.
**Pause after this turn** stops before the next model call. Reloading a page
never automatically restarts a discussion.

## Choose the decision structure

- **Explore opinions** compares positions, objections, and tradeoffs.
- **Seek consensus** puts one facilitator proposal to every persona. Only
  unanimous agreement counts as consensus. Objections and abstentions remain
  visible, even if the facilitator recommends an approach.
- **Vote on options** uses at least two fixed options. Every persona chooses one
  or abstains, with a reason. Counts are computed from ballots, not generated
  by the facilitator. A sole leader is a plurality; ties and all-abstained
  outcomes have no winner.

Each persona first gives an independent opening, without seeing other openings.
Two reply rounds are the default, so personas can respond to earlier replies. In each reply round, every persona sees the same completed earlier rounds.
Replies target a different participant's note from the preceding round, rotating through other participants across rounds, quote its exact point, respond, and state whether their position changed. Ballots must supply a reason, strongest counterargument, and declare any conditions that would reverse the choice (an empty conditions list is allowed). Extra claims must be declared as assumptions. This supports
back-and-forth while reducing order bias. Ballots cannot see other ballots.
The computed decision is included directly in the recorded synthesis. The facilitator records approach, agreement, downsides, evidence gaps, and next steps. The host preserves declared dissent and qualifications directly from participant notes. The facilitator has no ballot.

Use the Lenny chooser's task suggestions and source passages to choose a role
that owns the decision and another that can challenge it. A selected role is
one synthetic participant; selected guest passages inform that lens. These are
not impersonations or claims about a guest's present opinions. Saved persona
and role/source briefs are frozen when creating the room.

## Run through a host

Install and sign in to the Codex or Claude CLI, then start the app with
`npm run web:build` and `npm run web:start`. The app binds to `127.0.0.1`.
The default is **Luna High** (`codex:luna-high`): Codex executes `gpt-6-luna`
with `model_reasoning_effort="high"`. The other choice is **Claude Sonnet High**
(`claude:sonnet`): Claude executes its `sonnet` alias with `--effort high`.
These are supported execution choices, not a check of installation, sign-in,
or account model access. The selected CLI must be on the server's PATH.
The room's model label records the requested host configuration. Codex's JSONL
completion stream does not report the resolved model or reasoning effort;
its model and effort are pinned through native CLI arguments. Claude's receipt
must report the Sonnet model family; its effort is also configured through the
CLI. These receipts do not independently attest the provider's computation.

Each room freezes its selected execution profile. There is no weaker-model,
Ollama, or automatic provider fallback. Older rooms remain readable and
exportable; create a new room to execute with a supported profile.

Optional server settings:

- `PERSONA_DISCUSSION_CODEX_BIN` and `PERSONA_DISCUSSION_CLAUDE_BIN`: paths to
  the respective host executables when they are not on PATH.
- `PERSONA_LAB_HOME`: shared library root, default `~/.persona-lab`.

Each turn uses a fresh ephemeral host session in a temporary directory,
with JSON schema output. Claude safe mode disables customizations, hooks,
plugins and tools. Codex ignores user configuration and repository rules;
hooks, plugins, shell, app, browser, agent and code execution features are
disabled and its sandbox is read-only. Turns use only the supplied context;
they do not browse or invoke tools. Unexpected tool activity or incomplete
structured output is rejected. Each call has a two-minute timeout. Temporary
files are removed after the call. Authentication stays with the existing host
CLI. Context, participant briefs, and recorded conversation are sent to the
selected provider; stored rooms and exports stay in the local library.
Child processes inherit host authentication homes and basic OS settings only;
API keys, provider URL overrides and model-remapping variables are excluded.
Only fixed discussion policy and the response's structural shape are passed
as command arguments. Source quotations, exact choices and conversation text
travel on stdin; the protocol validates those exact constraints after output.
Codex additionally reads its full schema from the private temporary file.

Required synthesis fields keep agreement, downsides, evidence gaps, and next
steps in the record. Dissent and qualifications are assembled from exact
participant objections, positions, counterarguments, conditions, and
assumptions, with note references; unanimous votes cannot erase them.

Rooms live in `PERSONA_LAB_HOME/discussions/<id>.json`. Their contract is separate
from existing council reviews and CLI encounters. Turn requests carry an expected
revision and reserve one pending turn under a local store lock. Concurrent turn reservations or stale revisions return a conflict; an occupied disk transaction returns 503. Finalizing a completed turn retries brief disk contention asynchronously before failing. A failed model call preserves prior notes and
can be retried. A lost server request can be resumed after its pending lease
expires; late results cannot replace the resumed turn. A refresh shows that
lease and recorded progress. A filesystem lock left by a process killed during
a disk transaction is not automatically stolen. It returns an immediate 503
with the lock path. If its writer crashed, stop all Persona Lab writers before
removing that orphaned lock and resuming.

## Inspect and reuse notes

Search matches message text, message IDs, message types, speaker names, and ballot choices.
Filter by speaker. Recorded-note links clear filters and jump to the cited
message. The synthesis is searchable alongside the dialogue. Markdown and JSON
exports include the immutable setup, source briefs, transcript, references,
ballots, computed decision, and synthesis.

The API exposes `GET/POST /api/discussions`, `GET /api/discussions/models`,
`GET /api/discussions/<id>` (optional `format=markdown|json`), and
`POST /api/discussions/<id>/advance` with `{ "revision": <current revision> }`.
Writes require the loopback app host and a matching Origin (or same-origin fetch metadata); programmatic clients should send an Origin header matching the app URL. Unreadable saved files are reported and skipped in the list.

Creation accepts topic, goal, context, mode, rounds, options (labels), model,
`persona_ids`, and `lenny_selections` (`role_id`, `speaker_ids`). Participant
briefs are resolved server-side; caller-supplied identities cannot replace them.

## Limits and interpretation

One model simulates multiple perspectives. Canonical dissent records preserve declared qualifications; they cannot detect every concern the model failed to declare. Personas are not independent human
respondents; their votes do not estimate population preferences or user research
percentages. Dialogue can cause conformity, and a facilitator can miss or
mischaracterize a disagreement. Identical repeated qualifications are grouped with all their source note IDs. The web synthesis keeps them in an expandable record; search and exports include their full text. Original openings, individual ballots, and
referenced transcript remain available to check the synthesis. Citation checks verify exact quoted text and message IDs; they do not verify whether the response correctly interprets the quotation or whether generated claims are true.

Provide actual UI descriptions and observations in the context field. Links
alone are not fetched, and this text discussion does not inspect image pixels
or browse for evidence. The internal room manages the conversation and invokes
the selected host once per turn. Rally transport and importing external agents'
turns are not implemented by this feature.
