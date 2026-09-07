# UI-Test Council — Easy Terminal heuristic eval (2026-06-08)

4 personas (Dee, Priya, Morgan, Nadia), rally-workflows Tier-1, evaluating the live
AX-verified ET UI from each persona's use case.

## What works (validated)
- Tab selection via underline + weight ("clean, no ambiguous blobs" — Priya).
- Inspector INPUTS/OUTPUTS/AGENT/RUNTIME separation (Priya, Morgan).
- RUNTIME STACK real names + select-to-detail + config/live provenance tag (Dee, Morgan, Nadia — all).
- OUTPUTS deliverables-vs-files-worked-on split ("intentional vs incidental" — Morgan).
- Instant agent launch / tab appears immediately ("strong demo moment" — Nadia).
- Dormant state reads honestly (Priya).

## Convergent friction (high signal — multiple personas)
1. **Missing time + authorship metadata** — dormant pane has no when/why/exit-code (Dee);
   coordination strip + outputs have no timestamp/author = "assertion, not evidence" (Morgan).
   → maps to the daemon-owned I/O LEDGER (reliability lane) + add timestamps to coordination/dormant.
2. **Composer may be too large / inverts read order** — Priya AND Nadia independently:
   the large composer buries the terminal output; "a chat mental model multi-agent
   MONITORING will outgrow"; "a buyer sees a chat window, not orchestration."
   ⚠️ TENSION with the recent "make the text box larger" change — surfaced for the user.
3. **No per-tab status signal** — tabs look identical regardless of running/waiting/stuck (Nadia);
   "is this even running?" → the dormant-tab-cue + per-tab status indicator.
4. **Numbered-only workspace rail = working-memory tax** — "numbers = position, not identity;
   rebuilding the map every glance" (Priya). ⚠️ TENSION with the recent "just numbers" change.

## Missing (asks)
- Session event log with timestamps (Dee).
- Timestamp + authorship on coordination notes + dormant + inputs audit/intake manifest (Morgan).
- Per-tab status indicator (Nadia).
