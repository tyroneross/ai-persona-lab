# Decision Studio setup

Decision Studio prepares a structured decision request for the current agent. Use it to request independent reviews or compare alternatives you already have.

Start the local server from the repository root:

```sh
python3 modules/decision-studio/studio.py
```

Open the printed loopback URL, `http://127.0.0.1:54701/` by default. Keeping the same port preserves browser drafts between restarts. **Request reviews** saves at least two selected roles, including optional editable briefs. **Compare existing alternatives** saves at least two named options, each with a source reference or pasted text, and does not require reviewer roles. Both modes preserve the decision, sources, comparison units, and notes when you save the request. The server writes `~/.decision-studio/review-request.json` by default. Pass `--data-dir <directory>` to isolate a session. Reloading the page restores the saved request. A stale browser cannot overwrite a newer revision; it keeps its edits and asks the user to reload.

Templates only suggest structure. README, UI/UX, writing, and custom requests all use the same file contract. Suggested roles start unselected, and every role and comparison unit remains editable. Changing templates adds suggestions while preserving your edits. **Restore prior browser draft** recovers the draft kept before an explicit reload. Saved files use owner-only permissions.

After independent outputs exist, create the comparison with the existing generator rather than adding renderer logic here:

```sh
python3 skills/persona-output-comparison/scripts/create_dashboard.py <comparison-input.json> --out <output-directory>
python3 <output-directory>/serve.py
```

The current agent reads `review-request.json` on the next turn, gathers authorized independent outputs, and supplies those outputs to the comparison generator. The browser does not run models. Screenshot alignment remains outside this setup module.
