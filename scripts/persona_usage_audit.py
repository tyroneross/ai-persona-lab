#!/usr/bin/env python3
"""
persona_usage_audit — how often is persona-lab actually used, versus personas
being run by hand?

Streams Claude Code session transcripts and classifies every persona-related
event into one of two lanes:

  PLUGIN   the persona-lab plugin did the work — its skill, its slash commands,
           its named agents, or the `persona` CLI.
  AD-HOC   a persona was used without it — a subagent briefed "you are a <role>,
           review this", an inline panel in the main thread, or the AI User
           Personas app's HTTP API driven directly.

The gap between the two lanes is the plugin's adoption gap: work the plugin
exists to do, done some other way.

Reads only; writes nothing. Usage:
    python3 scripts/persona_usage_audit.py [--days N] [--json out.json]
"""

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

TRANSCRIPT_ROOT = Path.home() / ".claude" / "projects"
CODEX_ROOTS = [Path.home() / ".codex" / "sessions",
               Path.home() / ".codex" / "archived_sessions"]

# --- classification --------------------------------------------------------

# A persona is in play at all.
PERSONA_RE = re.compile(r"\bpersonas?\b", re.I)
# Guard: "personalization"/"personalized"/"personal" must never count.
NOT_PERSONA_RE = re.compile(r"personali[sz]|\bpersonal\b", re.I)

PLUGIN_AGENTS = {
    "persona-panel-orchestrator",
    "persona-perspective-reviewer",
    "persona-research-adjudicator",
}
# `persona` CLI, not the word persona in prose.
CLI_RE = re.compile(r"(?:^|[;&|]\s*|\$\(\s*)persona\s+(new|save|validate|list|show|search|rm|archive|roster|panel|encounter|home)\b")
SLASH_RE = re.compile(r"/(?:ai-)?persona-lab:([\w-]+)")
APP_API_RE = re.compile(r"/api/councils\b")

# Ad-hoc persona framing inside a subagent brief or inline prompt.
# Talking ABOUT personas, not AS one: mining, auditing, migrating, or reading
# the persona corpus. These must never count as persona usage.
META_RE = re.compile(
    r"(read-only (?:mining|analysis)|mining task|grep -r|classify every hit"
    r"|persona\.schema\.json|personas\.json|persona-lab"
    r"|find (?:every|where) .{0,40}persona|migrat\w+ .{0,30}persona"
    r"|report .{0,30}(?:path|file paths))",
    re.I,
)

ADHOC_BRIEF_RE = re.compile(
    r"(you are (?:a|an|the)\s+[^.\n]{0,60}?\b(?:user|reviewer|buyer|recruiter|novice|expert|admin|manager|researcher|skeptic|operator|founder|engineer)\b"
    r"|as (?:a|an|the)\s+[^.\n]{0,40}?persona"
    r"|from the perspective of (?:a|an|the)\b"
    r"|persona (?:panel|council|review|pass|swarm|audit)"
    r"|review (?:this|it) as (?:a|an)\b)",
    re.I,
)


def iter_tool_uses(msg):
    """Yield (name, input_dict) for every tool_use block in a message."""
    content = msg.get("content")
    if not isinstance(content, list):
        return
    for block in content:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            yield block.get("name", ""), block.get("input") or {}


def text_of(msg):
    """Flatten a message's text blocks."""
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    out = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            out.append(block.get("text") or "")
    return "\n".join(out)


def mentions_persona(s):
    if not s:
        return False
    return bool(PERSONA_RE.search(s))


def classify_event(tool, inp, role, body):
    """
    Return (lane, label) or None.
    lane is "plugin" or "adhoc".
    """
    # --- plugin lane -------------------------------------------------------
    if tool == "Skill":
        name = str(inp.get("skill", ""))
        if "persona-lab" in name or name == "persona-lab":
            return "plugin", f"skill:{name}"
    if tool in ("Agent", "Task"):
        sub = str(inp.get("subagent_type", ""))
        if sub in PLUGIN_AGENTS or sub.endswith(tuple(PLUGIN_AGENTS)):
            return "plugin", f"agent:{sub}"
    if tool == "Bash":
        cmd = str(inp.get("command", ""))
        m = CLI_RE.search(cmd)
        if m:
            return "plugin", f"cli:persona {m.group(1)}"

    # A slash command shows up as user text.
    if role == "user":
        m = SLASH_RE.search(body or "")
        if m:
            return "plugin", f"command:{m.group(0)}"

    # --- ad-hoc lane -------------------------------------------------------
    if tool in ("Agent", "Task"):
        prompt = str(inp.get("prompt", "")) + " " + str(inp.get("description", ""))
        # Mentioning the word is not using one. An agent that greps for
        # "persona" is doing research ABOUT personas, not speaking AS one.
        if META_RE.search(prompt):
            return None
        if ADHOC_BRIEF_RE.search(prompt):
            return "adhoc", "subagent-briefed-as-persona"
        if mentions_persona(prompt):
            return "adhoc", "subagent-prompt-mentions-persona"
    if tool == "Bash":
        cmd = str(inp.get("command", ""))
        if APP_API_RE.search(cmd):
            return "adhoc", "app-api:councils"
    if tool in ("WebFetch", "Fetch") and APP_API_RE.search(json.dumps(inp)[:2000]):
        return "adhoc", "app-api:councils"

    return None


def scan_file(path, since):
    """Stream one transcript. Returns (events, session_meta) or None."""
    events = []
    cwd = None
    ts_first = None
    ts_last = None
    inline_panel = False

    try:
        with path.open("r", encoding="utf8", errors="replace") as fh:
            for line in fh:
                if not line.strip():
                    continue
                # cheap prefilter: skip lines that cannot matter
                if "persona" not in line.lower() and "councils" not in line.lower():
                    # still need timestamps/cwd from early lines
                    if ts_first is not None and cwd is not None:
                        continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue

                if cwd is None and isinstance(rec.get("cwd"), str):
                    cwd = rec["cwd"]
                ts = rec.get("timestamp")
                if isinstance(ts, str):
                    if ts_first is None:
                        ts_first = ts
                    ts_last = ts

                msg = rec.get("message")
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role") or rec.get("type")
                body = text_of(msg)

                # user-typed slash command
                hit = classify_event("", {}, role, body)
                if hit:
                    events.append((hit[0], hit[1], ts))

                for tool, inp in iter_tool_uses(msg):
                    hit = classify_event(tool, inp, role, body)
                    if hit:
                        events.append((hit[0], hit[1], ts))

                # inline panel in the main thread: assistant prose that runs
                # personas itself rather than dispatching or calling the plugin
                if role == "assistant" and body and mentions_persona(body):
                    if re.search(r"persona (?:1|one|panel|roster)\b|as the (?:novice|expert|skeptic|recruiter)", body, re.I):
                        inline_panel = True
    except Exception as e:
        print(f"warn: {path.name}: {e}", file=sys.stderr)
        return None

    if since and ts_last:
        try:
            if datetime.fromisoformat(ts_last.replace("Z", "+00:00")) < since:
                return None
        except Exception:
            pass

    if inline_panel:
        events.append(("adhoc", "inline-panel-in-thread", ts_last))

    if not events:
        return None
    return events, {"cwd": cwd, "first": ts_first, "last": ts_last, "file": str(path)}


# --- Codex ------------------------------------------------------------------
# Codex rollout JSONL has a different shape than Claude Code's: records are
# {type: "response_item"|"session_meta", payload: {...}}. Tool calls arrive as
# payload.type in {function_call, custom_tool_call} with the command inside a
# JSON-string `arguments` or a free-form `input`. Same two lanes, same rules.

def scan_codex_file(path, since):
    events = []
    cwd = None
    ts_first = ts_last = None
    inline_panel = False
    try:
        with path.open("r", encoding="utf8", errors="replace") as fh:
            for line in fh:
                low = line.lower()
                if "persona" not in low and "councils" not in low:
                    if ts_first is not None and cwd is not None:
                        continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                ts = rec.get("timestamp")
                if isinstance(ts, str):
                    if ts_first is None:
                        ts_first = ts
                    ts_last = ts
                pay = rec.get("payload") or {}
                if rec.get("type") == "session_meta":
                    cwd = cwd or pay.get("cwd")
                    continue
                if rec.get("type") != "response_item":
                    continue

                ptype = pay.get("type")

                if ptype in ("message", "agent_message"):
                    role = pay.get("role") or "assistant"
                    content = pay.get("content")
                    if isinstance(content, list):
                        body = "\n".join(b.get("text", "") for b in content
                                         if isinstance(b, dict) and b.get("text"))
                    else:
                        body = str(content or "")
                    # Codex has no <system-reminder>; developer role is harness context
                    if role == "developer":
                        continue
                    if role == "user":
                        m = SLASH_RE.search(body)
                        if m:
                            events.append(("plugin", f"command:{m.group(0)}", ts))
                        elif ADHOC_BRIEF_RE.search(body) and not META_RE.search(body):
                            events.append(("adhoc", "codex-user-asked-for-personas", ts))
                    elif body and mentions_persona(body) and re.search(
                            r"persona (?:1|one|panel|roster)\b|as the (?:novice|expert|skeptic|recruiter)",
                            body, re.I):
                        inline_panel = True

                elif ptype in ("function_call", "custom_tool_call"):
                    blob = str(pay.get("arguments") or "") + " " + str(pay.get("input") or "")
                    m = CLI_RE.search(blob)
                    if m:
                        events.append(("plugin", f"cli:persona {m.group(1)}", ts))
                    elif APP_API_RE.search(blob):
                        events.append(("adhoc", "app-api:councils", ts))
                    elif ADHOC_BRIEF_RE.search(blob) and not META_RE.search(blob):
                        events.append(("adhoc", "codex-subagent-briefed-as-persona", ts))
    except Exception as e:
        print(f"warn: {path.name}: {e}", file=sys.stderr)
        return None

    if since and ts_last:
        try:
            if datetime.fromisoformat(ts_last.replace("Z", "+00:00")) < since:
                return None
        except Exception:
            pass
    if inline_panel:
        events.append(("adhoc", "inline-panel-in-thread", ts_last))
    if not events:
        return None
    return events, {"cwd": cwd, "first": ts_first, "last": ts_last, "file": str(path)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=0, help="only sessions active in the last N days")
    ap.add_argument("--json", help="write full results here")
    ap.add_argument("--root", default=str(TRANSCRIPT_ROOT))
    ap.add_argument("--no-codex", action="store_true", help="skip Codex sessions")
    args = ap.parse_args()

    since = None
    if args.days:
        since = datetime.now(timezone.utc) - timedelta(days=args.days)

    files = [(f, "claude") for f in sorted(Path(args.root).rglob("*.jsonl"))]
    if not args.no_codex:
        for root in CODEX_ROOTS:
            if root.exists():
                files += [(f, "codex") for f in sorted(root.rglob("*.jsonl"))]
    lane_counts = Counter()
    label_counts = Counter()
    sessions = {"plugin": set(), "adhoc": set(), "both": set()}
    by_project = defaultdict(lambda: Counter())
    rows = []

    host_counts = Counter()
    for f, host in files:
        got = scan_codex_file(f, since) if host == "codex" else scan_file(f, since)
        if not got:
            continue
        events, meta = got
        lanes = {e[0] for e in events}
        sid = f.stem
        proj = (meta["cwd"] or f.parent.name).split("/")[-1]

        host_counts[host] += 1
        for lane, label, _ts in events:
            lane_counts[f"{host}:{lane}"] += 1
            lane_counts[lane] += 1
            label_counts[(lane, label)] += 1
            by_project[proj][lane] += 1

        if lanes == {"plugin"}:
            sessions["plugin"].add(sid)
        elif lanes == {"adhoc"}:
            sessions["adhoc"].add(sid)
        else:
            sessions["both"].add(sid)

        rows.append({
            "session": sid, "host": host, "project": proj, "last": meta["last"],
            "plugin": sum(1 for e in events if e[0] == "plugin"),
            "adhoc": sum(1 for e in events if e[0] == "adhoc"),
            "labels": sorted({e[1] for e in events}),
        })

    total_sessions = len(rows)
    print(f"Scanned {len(files)} transcripts. {total_sessions} touched personas"
          + (f" in the last {args.days} days." if args.days else "."))
    print()
    print("SESSIONS BY LANE")
    print(f"  plugin only : {len(sessions['plugin']):>4}")
    print(f"  ad-hoc only : {len(sessions['adhoc']):>4}   <- the adoption gap")
    print(f"  both        : {len(sessions['both']):>4}")
    print()
    print("SESSIONS BY HOST")
    for h, n in host_counts.most_common():
        print(f"  {h:<8} {n:>4}")
    print()
    print("EVENTS BY LANE")
    tot = sum(lane_counts.values()) or 1
    tot = (lane_counts["plugin"] + lane_counts["adhoc"]) or 1
    for lane in ("plugin", "adhoc"):
        n = lane_counts[lane]
        print(f"  {lane:<8} {n:>5}  ({100*n/tot:.0f}%)   "
              f"claude={lane_counts[f'claude:{lane}']} codex={lane_counts[f'codex:{lane}']}")
    print()
    print("WHAT WAS ACTUALLY CALLED")
    for (lane, label), n in label_counts.most_common(25):
        print(f"  {lane:<7} {label:<34} {n:>5}")
    print()
    print("BY PROJECT (top 15 by total persona events)")
    ranked = sorted(by_project.items(), key=lambda kv: -sum(kv[1].values()))[:15]
    print(f"  {'project':<38} {'plugin':>7} {'ad-hoc':>7}")
    for proj, c in ranked:
        print(f"  {proj[:38]:<38} {c['plugin']:>7} {c['adhoc']:>7}")

    if args.json:
        Path(args.json).write_text(json.dumps({
            "scanned": len(files),
            "sessions_by_lane": {k: len(v) for k, v in sessions.items()},
            "events_by_lane": dict(lane_counts),
            "labels": {f"{l}|{lb}": n for (l, lb), n in label_counts.items()},
            "by_project": {k: dict(v) for k, v in by_project.items()},
            "sessions": sorted(rows, key=lambda r: r["last"] or "", reverse=True),
        }, indent=2))
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
