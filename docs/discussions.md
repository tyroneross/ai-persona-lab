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

## Run locally

Start a local [Ollama](https://docs.ollama.com/quickstart) server with an installed
chat model, then start the app with `npm run web:build` and `npm run web:start`.
The root development and start commands bind the app to `127.0.0.1`; use the local HTTP app address. The model picker reads installed local models. Cloud aliases and upstream-host models are excluded and cannot execute rooms. The default prefers installed `gpt-oss:20b`, then `qwen3:8b-q4_K_M`, then `qwen2.5-coder:7b`, otherwise the first local model. Set the model explicitly for your hardware and task. Select a model capable of chat
completion; embedding-only models cannot execute discussions.

Optional server settings:

- `PERSONA_DISCUSSION_MODEL`: initial model choice. Each room freezes its model.
- `PERSONA_DISCUSSION_OLLAMA_URL`: local HTTP server, default
  `http://127.0.0.1:11434`. Only localhost/loopback endpoints are accepted.
- `PERSONA_LAB_HOME`: shared library root, default `~/.persona-lab`.

Execution uses Ollama's documented [`/api/chat`](https://docs.ollama.com/api/chat)
with JSON schema output and streaming disabled. Required synthesis fields keep agreement, downsides, evidence gaps, and next steps in the record. Dissent and qualifications are assembled from exact participant objections, positions, counterarguments, conditions, and assumptions, with note references; unanimous votes cannot erase them. Model details determine the
available context. A conservative byte-based estimate reserves room for output;
requests that exceed the model context stop with an explicit error rather than
silently truncating the conversation. Each call has a two-minute timeout and
1024 output-token budget, or 4096 for thinking-capable models when thinking cannot be disabled. Supported thinking controls come from model details; thinking is disabled when supported, otherwise low thinking is used when available. These are short discussion turns, not long essays.

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
or browse for evidence. Local execution makes an internal room sufficient;
Rally transport is not required. External host/Rally execution and importing
external agents' turns are not implemented by this feature.
