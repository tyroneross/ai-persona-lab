# Strategy Council — Easy Terminal wedge / beachhead / why-now (2026-06-08)

4 personas (Elena, Marcus, Nadia, Morgan), rally-workflows Tier-1, independent positions.

## Convergence
- **Wedge:** the Rust daemon (ptyd) owning pane lifecycle + native agent coordination
  (rally) in ONE substrate — multi-agent coordination as a runtime PRIMITIVE, not a
  plugin/skin. Warp/iTerm/tmux/VS Code structurally can't replicate without rebuilding
  their foundation (~18–24mo to clone). Unanimous.
- **Beachhead:** developers running 2+ coding agents concurrently (Claude+Codex+shells)
  on macOS — Series B–D startup engineers / solo power-devs with autonomy, feeling the
  coordination tax daily, high tolerance for 0.1.0. Unanimous.
- **Why now:** agentic coding (Claude Code + Codex) is 12–18mo old; managing N agent
  terminals by hand now costs sprint cycles; no purpose-built host UI exists yet — window
  open before a funded competitor ships a native client.

## Risks (diverse, all valid)
- Elena: **attribution** — ET becomes invisible plumbing; a thin wrapper captures the narrative.
- Marcus: **narrative** — if you can't tell it in 90s without a live demo, a simpler "multi-agent terminal" message wins first.
- Nadia: **trust** — "I won't install a Rust daemon I can't audit" → need open/signed/audit-trail motion.
- Morgan: **state-detection accuracy** — the moat depends on the status matchers; if "working" shows "idle"/"blocked" shows "done", trust collapses. Wants the false-positive rate. (Verification-first, in character.)
