#!/usr/bin/env node
/**
 * persona — deterministic substrate for persona-lab.
 *
 * The CLI owns the library (save/recall), schema validation, and review
 * planning. Generating persona *content* and running the review are done by the
 * LLM host (Claude Code skill, any coding agent, Codex), which calls this CLI to
 * persist and recall. No API key is ever needed here.
 *
 *   persona new "<brief>" [--count N] [--roster <name>]   scaffold lenses + gen-prompt
 *   persona save <file|->        persona validate <file|->
 *   persona list / show <id> / search "<q>" / rm <id> / archive <id>
 *   persona roster save <name> --lenses a,b,c [--personas id1,id2] [--use-case ..] [--desc ..]
 *   persona roster list / show <name> / rm <name>
 *   persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high]
 *   persona home
 *
 * Add --json to most commands for machine output.
 */

import { readFileSync } from "node:fs";
import {
  libraryHome, SCHEMA_VERSION,
  listPersonas, getPersona, savePersona, removePersona, archivePersona,
  searchPersonas, validatePersona, evidenceId,
  listRosters, getRoster, saveRoster, removeRoster,
} from "../lib/library.mjs";
import { ROLE_LIBRARY, DEFAULT_CRITIQUE_LENSES, selectRoles, findRole, isAdversarial } from "../lib/roles.mjs";
import {
  scaffoldEncounter, saveEncounter, validateEncounter, listEncounters, getEncounter, encountersDir,
} from "../lib/encounters.mjs";

// --- arg parsing -----------------------------------------------------------

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function out(obj, json) {
  if (json) process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function die(msg, code = 1) {
  process.stderr.write(`persona: ${msg}\n`);
  process.exit(code);
}

function readInputFile(ref) {
  if (ref === "-" || ref === undefined) return readFileSync(0, "utf8");
  return readFileSync(ref, "utf8");
}

const LEVELS = {
  low: { min: 3, max: 4, note: "single independent pass, cheap first look" },
  medium: { min: 4, max: 6, note: "independent passes + synthesis, red-team required" },
  high: { min: 6, max: 8, note: "independent passes + adversarial verification of critical findings + measurement rigor" },
};

// --- commands --------------------------------------------------------------

function cmdHome() {
  process.stdout.write(`${libraryHome()}\n`);
}

function measurementSet() {
  return ["Task completion", "Comprehension", "Friction", "Trust", "Risk", "Business fit"];
}

function lensView(role) {
  return {
    name: role.name,
    perspective: role.perspective,
    adversarial: Boolean(role.adversarial),
    primary_question: role.primaryQuestion,
    success_signal: role.successSignal,
    failure_signal: role.failureSignal,
  };
}

function resolveLenses({ roster, auto, count, brief }) {
  if (roster) {
    const r = getRoster(roster);
    if (!r) die(`roster not found: ${roster}`);
    const roles = (r.lenses || []).map((l) => findRole(l)).filter(Boolean);
    if (!roles.length) die(`roster "${roster}" has no resolvable lenses`);
    return { roles, source: `roster:${r.name}`, roster: r };
  }
  const roles = auto || brief ? selectRoles(brief || "", count) : DEFAULT_CRITIQUE_LENSES.slice(0, count);
  return { roles, source: brief ? "auto-selected" : "default-critique" };
}

function ensureAdversarial(roles) {
  if (roles.some(isAdversarial)) return roles;
  const adv = findRole("red-team");
  return adv ? [...roles.slice(0, -1), adv] : roles;
}

function scaffoldPersona(role, brief) {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    // id/timestamps assigned on save; left blank here as a fill-in scaffold
    status: "draft",
    name: "",
    archetype: role.name,
    role: role.name,
    summary: "",
    primary_goal: "",
    job_to_be_done: "When [situation], I want to [motivation], so I can [outcome].",
    goals: [],
    frustrations: [],
    motivations: [],
    behaviors: [],
    needs: [],
    anti_goals: [],
    scenarios: [{ title: "", description: "" }],
    evidence: [
      {
        id: evidenceId(role.perspective),
        source_type: "synthetic",
        summary: `Synthetic ${role.name} lens generated for: ${brief}. Not grounded in real user data.`,
        confidence: 0.4,
      },
    ],
    provenance: "synthetic-assumed",
    confidence: 0.4,
    tags: [role.perspective],
    lens: lensView(role),
    _fill: {
      guidance:
        "Fill name, summary (>=40 chars), primary_goal, job_to_be_done, and the goal/frustration/motivation/behavior/need lists from this lens' viewpoint on the brief. Add anti_goals (what makes this persona abandon/distrust). If you ground any field in real evidence, add an evidence item and raise provenance to synthetic-grounded + confidence.",
    },
  };
}

function cmdNew(positional, flags) {
  const brief = positional.join(" ").trim();
  if (!brief && !flags.roster) die('usage: persona new "<brief>" [--count N] [--roster <name>]');
  const count = Number.parseInt(flags.count || "4", 10) || 4;
  const { roles, source } = resolveLenses({ roster: flags.roster, auto: true, count, brief });
  const finalRoles = ensureAdversarial(roles);
  const scaffolds = finalRoles.map((r) => scaffoldPersona(r, brief));

  const result = {
    brief,
    lens_source: source,
    lenses: finalRoles.map(lensView),
    measurement: measurementSet(),
    scaffolds,
    generation_prompt:
      `Generate ${scaffolds.length} distinct personas for this brief, one per lens above. ` +
      `Fill each scaffold independently — do NOT let the lenses converge. Ground fields in real ` +
      `evidence where available (raise provenance to synthetic-grounded); otherwise keep ` +
      `provenance synthetic-assumed and label as hypothesis. Then persist each with: ` +
      `persona save <file.json>. These personas are hypotheses for review, not validated users.`,
    reminder: "hypothesis, not validation",
  };

  if (flags.json) return out(result, true);

  process.stdout.write(`# Persona scaffold for: ${brief || "(roster)"}\n\n`);
  process.stdout.write(`Lens source: ${source}\n\n`);
  for (const r of finalRoles) {
    process.stdout.write(`- ${r.name}${r.adversarial ? " (adversarial / red-team)" : ""}: ${r.primaryQuestion}\n`);
  }
  process.stdout.write(`\nMeasurement: ${measurementSet().join(", ")}\n\n`);
  process.stdout.write(`Next: fill each scaffold from its lens, then \`persona save <file.json>\`.\n`);
  process.stdout.write(`Run with --json to get the fill-in scaffolds. Output is hypothesis, not validation.\n`);
}

function cmdSave(positional, flags, { validateOnly }) {
  const raw = readInputFile(positional[0]);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    die(`input is not valid JSON: ${e.message}`);
  }
  const personas = Array.isArray(parsed) ? parsed : parsed.personas ? parsed.personas : [parsed];

  if (validateOnly) {
    const results = personas.map((p) => ({ name: p.name || p.id || "(unnamed)", ...validatePersona(p) }));
    const ok = results.every((r) => r.ok);
    if (flags.json) out({ ok, results }, true);
    else {
      for (const r of results) process.stdout.write(`${r.ok ? "OK" : "FAIL"}  ${r.name}${r.ok ? "" : "\n  - " + r.errors.join("\n  - ")}\n`);
    }
    process.exit(ok ? 0 : 1);
  }

  const saved = [];
  for (const p of personas) {
    // strip scaffold-only helper fields
    const { lens, _fill, ...clean } = p;
    try {
      saved.push(savePersona(clean));
    } catch (e) {
      die(`could not save ${clean.name || clean.id || "(unnamed)"}: ${e.message}`);
    }
  }
  if (flags.json) out({ saved: saved.map((p) => ({ id: p.id, name: p.name })) }, true);
  else saved.forEach((p) => process.stdout.write(`saved ${p.id}  (${p.name})\n`));
}

function cmdList(flags) {
  const filters = {};
  if (flags.status) filters.status = String(flags.status).split(",");
  if (flags.role) filters.role = flags.role;
  if (flags.tag) filters.tag = flags.tag;
  const rows = listPersonas(filters);
  if (flags.json) return out({ count: rows.length, personas: rows }, true);
  if (!rows.length) return process.stdout.write("No saved personas. Generate with `persona new`.\n");
  for (const p of rows) {
    process.stdout.write(`${p.id}\n  ${p.name} — ${p.role} [${p.status}] conf ${p.confidence}\n  ${p.summary.slice(0, 100)}\n`);
  }
}

function cmdShow(positional, flags) {
  const p = getPersona(positional[0]);
  if (!p) die(`persona not found: ${positional[0] || "(none)"}`);
  if (flags.json) return out(p, true);
  process.stdout.write(`${JSON.stringify(p, null, 2)}\n`);
}

function cmdSearch(positional, flags) {
  const rows = searchPersonas(positional.join(" "));
  if (flags.json) return out({ count: rows.length, personas: rows }, true);
  if (!rows.length) return process.stdout.write("No matches.\n");
  for (const p of rows) process.stdout.write(`${p.id}  ${p.name} — ${p.role}\n`);
}

function cmdRm(positional, flags) {
  const ok = removePersona(positional[0]);
  if (!ok) die(`persona not found: ${positional[0] || "(none)"}`);
  if (flags.json) out({ removed: positional[0] }, true);
  else process.stdout.write(`removed ${positional[0]}\n`);
}

function cmdArchive(positional, flags) {
  const p = archivePersona(positional[0]);
  if (!p) die(`persona not found: ${positional[0] || "(none)"}`);
  if (flags.json) out({ archived: p.id }, true);
  else process.stdout.write(`archived ${p.id}\n`);
}

function cmdRoster(positional, flags) {
  const sub = positional[0];
  if (sub === "list") {
    const rows = listRosters();
    if (flags.json) return out({ count: rows.length, rosters: rows }, true);
    if (!rows.length) return process.stdout.write("No rosters. Create with `persona roster save <name> --lenses a,b,c`.\n");
    for (const r of rows) process.stdout.write(`${r.name}${r.use_case ? ` — ${r.use_case}` : ""}\n  lenses: ${r.lenses.join(", ")}\n  personas: ${r.persona_ids.length}\n`);
    return;
  }
  if (sub === "show") {
    const r = getRoster(positional[1]);
    if (!r) die(`roster not found: ${positional[1] || "(none)"}`);
    return process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  }
  if (sub === "rm") {
    const ok = removeRoster(positional[1]);
    if (!ok) die(`roster not found: ${positional[1] || "(none)"}`);
    return process.stdout.write(`removed roster ${positional[1]}\n`);
  }
  if (sub === "save") {
    const name = positional[1];
    if (!name) die("usage: persona roster save <name> --lenses a,b,c [--personas id1,id2] [--use-case ..] [--desc ..]");
    const lensNames = flags.lenses ? String(flags.lenses).split(",").map((s) => s.trim()) : [];
    const resolved = lensNames.map((l) => {
      const role = findRole(l);
      if (!role) die(`unknown lens: ${l} (see 'persona roster lenses')`);
      return role.name;
    });
    const roster = saveRoster({
      name,
      use_case: flags["use-case"] || "",
      description: flags.desc || flags.description || "",
      lenses: resolved,
      persona_ids: flags.personas ? String(flags.personas).split(",").map((s) => s.trim()) : [],
    });
    if (flags.json) out(roster, true);
    else process.stdout.write(`saved roster "${roster.name}" (${roster.lenses.length} lenses, ${roster.persona_ids.length} personas)\n`);
    return;
  }
  if (sub === "lenses") {
    for (const r of ROLE_LIBRARY) process.stdout.write(`${r.perspective.padEnd(14)} ${r.name}${r.adversarial ? " *adversarial" : ""}\n`);
    return;
  }
  die("usage: persona roster <save|list|show|rm|lenses> ...");
}

function cmdPanel(positional, flags) {
  const topic = positional.join(" ").trim();
  if (!topic && !flags.roster) die('usage: persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high]');
  const level = LEVELS[flags.level] ? flags.level : "medium";
  const bounds = LEVELS[level];
  const count = Number.parseInt(flags.count || String(bounds.min + 1), 10) || bounds.min + 1;
  const clamped = Math.min(Math.max(count, bounds.min), bounds.max);

  const { roles, source, roster } = resolveLenses({
    roster: flags.roster,
    auto: flags.auto || Boolean(topic),
    count: clamped,
    brief: topic,
  });
  const finalRoles = ensureAdversarial(roles);
  const savedPersonaIds = roster ? roster.persona_ids || [] : [];

  const plan = {
    topic,
    level,
    level_note: bounds.note,
    lens_source: source,
    lenses: finalRoles.map(lensView),
    saved_personas: savedPersonaIds,
    measurement: roster && roster.measurement ? roster.measurement : measurementSet(),
    protocol: {
      independence: "Run each lens as an independent pass with NO shared transcript, so no persona anchors on another. Synthesize only after all passes complete.",
      anti_sycophancy: "Each persona must surface anti-goals and may answer 'no concern' or 'cannot judge from available evidence' rather than fabricate a finding.",
      adversarial_required: finalRoles.some(isAdversarial),
      synthesis: "Cluster and dedupe findings; PRESERVE conflicts as explicit tradeoffs and keep dissenting critical findings. Label each finding's provenance (evidence-grounded vs assumption).",
      verification: level === "high" ? "Adversarially verify every critical finding with a second independent pass before reporting." : "Report findings with severity + confidence; no separate verification pass.",
    },
    report_template: [
      "Bottom line",
      "What was inspected",
      "Persona roster",
      "Measurement",
      "Priority findings (severity, evidence, impact, fix, confidence, provenance)",
      "Persona-specific findings",
      "Conflicts and tradeoffs",
      "Access gaps and assumptions",
      "Recommended next actions",
    ],
    reminder: "This panel produces hypotheses for review, not validated user research.",
  };

  if (flags.json) return out(plan, true);

  process.stdout.write(`# Persona panel plan: ${topic || roster?.name}\n\n`);
  process.stdout.write(`Level: ${level} (${bounds.note})\nLens source: ${source}\n\n`);
  process.stdout.write(`## Lenses (${finalRoles.length})\n`);
  for (const r of finalRoles) process.stdout.write(`- ${r.name}${r.adversarial ? " (adversarial / red-team)" : ""}: ${r.primaryQuestion}\n`);
  if (savedPersonaIds.length) process.stdout.write(`\nSaved personas: ${savedPersonaIds.join(", ")}\n`);
  process.stdout.write(`\n## Measurement\n${plan.measurement.map((m) => `- ${m}`).join("\n")}\n`);
  process.stdout.write(`\n## Protocol\n- Independence: ${plan.protocol.independence}\n- Anti-sycophancy: ${plan.protocol.anti_sycophancy}\n- Synthesis: ${plan.protocol.synthesis}\n- Verification: ${plan.protocol.verification}\n`);
  process.stdout.write(`\nReport back with: ${plan.report_template.join(" / ")}.\n`);
  process.stdout.write(`\n${plan.reminder}\n`);
}

function usage() {
  process.stdout.write(
    [
      "persona — task-specific persona panels + a recallable persona library",
      "",
      '  persona new "<brief>" [--count N] [--roster <name>] [--json]',
      "  persona save <file|->            persona validate <file|->",
      "  persona list [--tag t] [--role r] [--status s] [--json]",
      '  persona show <id> [--json]       persona search "<query>" [--json]',
      "  persona rm <id>                  persona archive <id>",
      "  persona roster save <name> --lenses a,b,c [--personas ids] [--use-case ..] [--desc ..]",
      "  persona roster list | show <name> | rm <name> | lenses",
      '  persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high] [--json]',
      "  persona home",
      "",
      `Library: ${libraryHome()}`,
    ].join("\n") + "\n"
  );
}


// --- encounters: what a persona has SEEN -----------------------------------
// Minimal CRUD port (new/save/validate/list/show). Run-linking (--run,
// attach to a multi-persona debate lane) intentionally NOT ported here --
// this plugin's own autonomous run driver owns run/lane concepts, and
// mixing two run models in one CLI would be a worse bug than the one this
// patch fixes. A persona still writes an independent, durable encounter
// record; it just isn't wired into this plugin's run lanes yet.
function cmdEncounter(positional, flags) {
  const sub = positional[0];
  const rest = positional.slice(1);

  if (sub === "new") {
    const personaId = rest[0];
    if (!personaId) die('usage: persona encounter new <persona_id> --artifact <slug> [--label ".."] [--version ".."] [--url ".."]');
    if (!flags.artifact) die("--artifact <slug> is required: an encounter is always with a named artifact");
    const scaffold = scaffoldEncounter({
      persona_id: personaId,
      artifact: {
        slug: flags.artifact,
        label: flags.label || flags.artifact,
        version: flags.version || null,
        url: flags.url || null,
      },
      blind: true,
    });
    if (flags.json) return out(scaffold, true);
    process.stdout.write(JSON.stringify(scaffold, null, 2) + "\n");
    process.stderr.write(
      "\npersona: fill this scaffold (findings, verdict, evidence), then:\n" +
      "  persona encounter save -\n"
    );
    return;
  }

  if (sub === "save") {
    const src = rest[0];
    if (!src) die("usage: persona encounter save <file|->");
    const raw = src === "-" ? readFileSync(0, "utf8") : readFileSync(src, "utf8");
    let e;
    try { e = JSON.parse(raw); } catch (err) { die(`invalid JSON: ${err.message}`); }
    let saved;
    try {
      saved = saveEncounter(e);
    } catch (err) {
      die(`could not save ${e.encounter_id || "(unnamed)"}: ${err.message}`);
    }
    if (flags.json) return out({ encounter_id: saved.encounter.encounter_id, path: saved.path }, true);
    process.stdout.write(`saved ${saved.encounter.encounter_id}\n  ${saved.path}\n`);
    return;
  }

  if (sub === "validate") {
    const src = rest[0];
    if (!src) die("usage: persona encounter validate <file|->");
    const raw = src === "-" ? readFileSync(0, "utf8") : readFileSync(src, "utf8");
    let e;
    try { e = JSON.parse(raw); } catch (err) { die(`invalid JSON: ${err.message}`); }
    const r = validateEncounter(e);
    if (flags.json) return out({ encounter_id: e.encounter_id || "(none)", ...r }, true);
    process.stdout.write(`${r.ok ? "OK" : "FAIL"}  ${e.encounter_id || "(none)"}${r.ok ? "" : "\n  - " + r.errors.join("\n  - ")}\n`);
    return;
  }

  if (sub === "list") {
    const personaId = rest[0];
    const rows = listEncounters({ persona_id: personaId, artifact: flags.artifact });
    if (flags.json) return out({ count: rows.length, encounters: rows }, true);
    if (!rows.length) return process.stdout.write(`No encounters yet.\nStore: ${encountersDir()}\n`);
    rows.forEach((e) =>
      process.stdout.write(
        `${e.encounter_id}\n  ${e.persona_id} met ${e.artifact.label}${e.artifact.version ? ` @ ${e.artifact.version}` : ""}\n`
      )
    );
    return;
  }

  if (sub === "show") {
    const e = getEncounter(rest[0]);
    if (!e) die(`encounter not found: ${rest[0] || "(none)"}`);
    if (flags.json) return out(e, true);
    process.stdout.write(JSON.stringify(e, null, 2) + "\n");
    return;
  }

  die("usage: persona encounter <new|save|validate|list|show> ...");
}

// --- dispatch --------------------------------------------------------------

function main() {
  const [, , cmd, ...rest] = process.argv;
  const { positional, flags } = parseArgs(rest);

  switch (cmd) {
    case "home": return cmdHome();
    case "new": return cmdNew(positional, flags);
    case "save": return cmdSave(positional, flags, { validateOnly: false });
    case "validate": return cmdSave(positional, flags, { validateOnly: true });
    case "list": return cmdList(flags);
    case "show": return cmdShow(positional, flags);
    case "search": return cmdSearch(positional, flags);
    case "rm": return cmdRm(positional, flags);
    case "archive": return cmdArchive(positional, flags);
    case "roster": return cmdRoster(positional, flags);
    case "panel": return cmdPanel(positional, flags);
    case "encounter": return cmdEncounter(positional, flags);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return usage();
    default:
      die(`unknown command: ${cmd}\nRun 'persona help'.`, 2);
  }
}

main();
