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
 *   persona encounter new <persona_id> --artifact <slug> [--label ..] [--version ..] [--informed ids]
 *   persona encounter save <file|->  | validate <file|-> | list [<persona_id>] | show <encounter_id>
 *   persona home
 *
 * Add --json to most commands for machine output.
 */

import { readFileSync, existsSync } from "node:fs";
import {
  libraryHome, SCHEMA_VERSION,
  listPersonas, getPersona, savePersona, removePersona, archivePersona,
  searchPersonas, validatePersona, withSaveDefaults, evidenceId,
  listRosters, getRoster, saveRoster, removeRoster,
} from "../lib/library.mjs";
import {
  scaffoldEncounter, saveEncounter, validateEncounter, listEncounters, getEncounter, encountersDir,
} from "../lib/encounters.mjs";
import {
  createRun, readRun, listRuns, attachEncounter, closeRun, validateRun,
  runEncounters, writeReport, runDir, runsDir, recordOutcome, provenRosters,
} from "../lib/runs.mjs";
import { unlinkEncounterRun } from "../lib/encounters.mjs";
import {
  checkRecallRequest, buildRecallBriefing, renderRecallBriefing,
  personaRecall, personaLifespan, permittedEncounters,
} from "../lib/recall.mjs";
import { ROLE_LIBRARY, DEFAULT_CRITIQUE_LENSES, selectRoles, findRole, isAdversarial } from "../lib/roles.mjs";
import { ARCHETYPE_CATALOG, composePersona, planConsultation } from "../lib/archetypes.mjs";
import { ingestCorpus, scanCorpus, searchSources, verifyPrinciples, reviewedPrinciples, registeredCorpus } from "../lib/sources.mjs";
import { createBriefPlan, parsePlanningArgs } from "../lib/brief-command.mjs";

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
  low: { min: 3, max: 4, note: "one independent pass per reviewer, cheap first look" },
  medium: { min: 4, max: 6, note: "independent passes + synthesis, red-team required" },
  high: { min: 6, max: 8, note: "independent passes + adversarial verification of critical findings + measurement rigor" },
};

// --- commands --------------------------------------------------------------

function cmdArchetypes(positional, flags) {
  const catalog = ARCHETYPE_CATALOG;
  const q = positional.join(' ').toLowerCase();
  const principles = reviewedPrinciples();
  const archetypes = catalog.archetypes.filter(a => (!flags.defaults || a.default) &&
    (!q || JSON.stringify(a).toLowerCase().includes(q))).map(a => ({ ...a,
      reviewed_principle_count: principles.filter(e => e.archetypes.includes(a.id)).length }));
  if (flags.json) return out({ ...catalog, archetypes }, true);
  process.stdout.write(`${catalog.policy}\n\n`);
  for (const a of archetypes) process.stdout.write(`${a.id}${a.default ? ' (default)' : ''}: ${a.goal}\n  Reviewed principles: ${a.reviewed_principle_count}. Examples: ${a.specialty_examples.map(p => p.join('/')).join(', ')}\n`);
}

function cmdCompose(positional, flags) {
  const result = composePersona({ archetypes: positional[0] || flags.archetypes,
    specialties: flags.specialties || [], task: flags.task || '', name: flags.name });
  if (flags.save) {
    result.persona = savePersona(result.persona);
    result.saved = true;
  }
  // JSON is the default so agents can persist result.persona without a parsing convention.
  return out(result, true);
}

function cmdConsult(positional, flags) {
  return out(planConsultation(positional.join(' '), {
    specialties: flags.specialties || [], archetypes: flags.archetypes || [],
    count: flags.count === undefined ? 5 : Number(flags.count), mode: flags.mode || 'consultant',
    artifact: flags.artifact, project: flags.project,
  }), true);
}

function cmdSources(positional, flags) {
  const [sub, ...rest] = positional;
  if (sub === 'ingest' || sub === 'scan') {
    if (!flags.root || flags.root === true) die('usage: persona sources ingest|scan --root <corpus-root>');
    const result = sub === 'ingest' ? ingestCorpus(flags.root) : scanCorpus(flags.root);
    return out(result, true);
  }
  if (sub === 'verify') {
    const root = flags.root || registeredCorpus()?.root;
    if (!root) die('Provide --root <corpus-root> or ingest a corpus first');
    const result = verifyPrinciples(root);
    out(result, true);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (sub === 'search') return out(searchSources(rest.join(' '), { root: flags.root }), true);
  if (sub === 'principles') return out(reviewedPrinciples(), true);
  if (!sub || sub === 'status') {
    const index = registeredCorpus();
    return out({ registered: Boolean(index), root: index?.root, fingerprint: index?.fingerprint,
      episode_count: index?.episode_count, reviewed_principles: reviewedPrinciples().length,
      status: 'Registry reflects last ingestion; use scan to recheck source and verify to check curated spans.' }, true);
  }
  die('usage: persona sources <status|scan|ingest|search|verify|principles>');
}

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
    // Validate as the persona will exist AFTER save, unless --strict. Reporting
    // "id is required" on a scaffold that save would mint is noise that reads
    // like breakage on a first run.
    const prep = (p) => {
      const { lens, _fill, ...clean } = p;
      return flags.strict ? clean : withSaveDefaults(clean);
    };
    const results = personas.map((p) => ({ name: p.name || p.id || "(unnamed)", ...validatePersona(prep(p)) }));
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
  if (sub === "from-run") {
    const id = positional[1];
    const name = flags.name && flags.name !== true ? String(flags.name) : null;
    if (!id || !name) die('usage: persona roster from-run <run_id> --name "<roster name>" [--use-case ".."]');
    const run = readRun(id);
    if (!run) die(`run not found: ${id}`);
    if (run.outcome?.verdict === "wasted") {
      die(`run ${id} was recorded as wasted. Promote a roster that earned it, or record a different verdict first.`);
    }
    const lenses = [...new Set((run.roster || [])
      .map((pid) => getPersona(pid))
      .filter(Boolean)
      .flatMap((p) => p.tags || []))];
    const saved = saveRoster({
      name,
      lenses: lenses.length ? lenses : ["general"],
      persona_ids: run.roster || [],
      use_case: (flags["use-case"] && flags["use-case"] !== true)
        ? String(flags["use-case"])
        : `Composition that produced a ${run.outcome?.verdict || "recorded"} panel on ${run.artifact?.label || run.artifact?.slug}.`,
    });
    if (flags.json) return out(saved, true);
    process.stdout.write(`saved roster "${saved.name}" from ${id}\n  ${(run.roster || []).length} personas, lenses: ${saved.lenses.join(", ")}\n`);
    return;
  }

  die("usage: persona roster <save|list|show|rm|lenses|from-run> ...");
}

function cmdPanel(positional, flags) {
  const topic = positional.join(" ").trim();
  if (!topic && !flags.roster) die('usage: persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high]');
  if (flags.level !== undefined && !Object.hasOwn(LEVELS, flags.level)) die(`unknown level: ${flags.level}; choose low, medium, or high`);
  if (flags.auto && flags.roster) die('--auto and --roster are mutually exclusive');
  const level = flags.level ?? "medium";
  const bounds = LEVELS[level];
  const requestedCount = flags.count === undefined ? null : Number(flags.count);
  if (requestedCount !== null && (!/^\d+$/.test(flags.count) || !Number.isSafeInteger(requestedCount) || requestedCount < bounds.min || requestedCount > bounds.max)) {
    die(`--count for ${level} must be an integer from ${bounds.min} to ${bounds.max}; requested ${flags.count}. Choose a compatible level or use persona brief for one reviewer.`);
  }
  const count = requestedCount ?? bounds.min + 1;

  const { roles, source, roster } = resolveLenses({
    roster: flags.roster,
    auto: flags.auto || Boolean(topic),
    count,
    brief: topic,
  });
  const finalRoles = ensureAdversarial(roles);
  if (finalRoles.length < bounds.min || finalRoles.length > bounds.max) die(`roster has ${finalRoles.length} lenses; ${level} requires ${bounds.min} to ${bounds.max}`);
  if (requestedCount !== null && finalRoles.length !== requestedCount) die(`--count requested ${requestedCount}, but roster has ${finalRoles.length} lenses; choose a matching roster`);
  const savedPersonaIds = roster ? roster.persona_ids || [] : [];

  const plan = {
    execution: "plan-only",
    model_calls: 0,
    requested_review_passes: requestedCount,
    effective_review_passes: finalRoles.length,
    additional_model_passes: level === "high" ? "one per critical finding, determined after review" : 0,
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
      verification: level === "high" ? "The host checks evidence. Adversarially verify each critical finding with a second independent model pass; report this additional usage separately." : "The host checks reported defects against the artifact and synthesizes findings; no separate model verification or judge pass.",
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
  process.stdout.write(`Review passes: ${plan.effective_review_passes} (requested: ${requestedCount ?? 'level default'}). Additional model passes: ${plan.additional_model_passes}. CLI prepares only; the host executes reviews.\n\n`);
  process.stdout.write(`## Lenses (${finalRoles.length})\n`);
  for (const r of finalRoles) process.stdout.write(`- ${r.name}${r.adversarial ? " (adversarial / red-team)" : ""}: ${r.primaryQuestion}\n`);
  if (savedPersonaIds.length) process.stdout.write(`\nSaved personas: ${savedPersonaIds.join(", ")}\n`);
  process.stdout.write(`\n## Measurement\n${plan.measurement.map((m) => `- ${m}`).join("\n")}\n`);
  process.stdout.write(`\n## Protocol\n- Independence: ${plan.protocol.independence}\n- Anti-sycophancy: ${plan.protocol.anti_sycophancy}\n- Synthesis: ${plan.protocol.synthesis}\n- Verification: ${plan.protocol.verification}\n`);
  process.stdout.write(`\nReport back with: ${plan.report_template.join(" / ")}.\n`);
  process.stdout.write(`\n${plan.reminder}\n`);
}

// --- encounters: what a persona has SEEN --------------------------------------

function cmdEncounter(positional, flags) {
  const [sub, ...rest] = positional;

  if (sub === "new") {
    const personaId = rest[0];
    if (!personaId) die('usage: persona encounter new <persona_id> --artifact <slug> [--label ".."] [--version ".."] [--url ".."] [--informed id1,id2] [--viewports a,b]');
    if (!getPersona(personaId)) die(`persona not found in the library: ${personaId}\nRun 'persona list' or save the persona first.`);
    if (!flags.artifact) die("--artifact <slug> is required: an encounter is always with a named artifact");

    const informed = flags.informed ? String(flags.informed).split(",").map((x) => x.trim()).filter(Boolean) : [];
    if (flags.run && !readRun(String(flags.run))) die(`run not found: ${flags.run}`);
    const persona = getPersona(personaId);
    if (informed.length) {
      const runRec = flags.run ? readRun(String(flags.run)) : null;
      const ctx = {
        artifact: flags.artifact,
        project: flags.project || runRec?.artifact?.project,
      };
      const verdict = checkRecallRequest(persona, informed, ctx);
      if (!verdict.ok) {
        die(`recall refused:\n- ${verdict.errors.join("\n- ")}\n\n` +
            `Permitted in scope "${personaRecall(persona)}": ` +
            (verdict.permitted.length ? verdict.permitted.map((e) => e.encounter_id).join(", ") : "(none)"));
      }
    }
    const e = scaffoldEncounter({
      persona_id: personaId,
      run_id: flags.run ? String(flags.run) : undefined,
      artifact: {
        slug: flags.artifact,
        label: flags.label || flags.artifact,
        url: flags.url || undefined,
        version: flags.version || undefined,
        frozen: Boolean(flags.version),
      },
      blind: informed.length === 0,
      prior: informed,
      viewports: flags.viewports ? String(flags.viewports).split(",").map((x) => x.trim()).filter(Boolean) : undefined,
      driver: flags.driver || undefined,
      time_budget: flags["time-budget"] || undefined,
    });

    if (flags.json) return out(e, true);
    process.stdout.write(`${JSON.stringify(e, null, 2)}\n`);
    process.stderr.write(
      "\nFill this in and pipe it back BEFORE you return:\n" +
      "  persona encounter save -\n" +
      "`verbatim` is authoritative and is never summarised. Anything you could not settle\n" +
      "goes in `unanswered` — there is no reliable second turn.\n"
    );
    return;
  }

  if (sub === "save" || sub === "validate") {
    const raw = readInputFile(rest[0]);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      die(`input is not valid JSON: ${e.message}`);
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];

    if (sub === "validate") {
      const results = items.map((e) => ({ encounter_id: e.encounter_id || "(none)", ...validateEncounter(e) }));
      const ok = results.every((r) => r.ok);
      if (flags.json) out({ ok, results }, true);
      else for (const r of results) {
        process.stdout.write(`${r.ok ? "OK" : "FAIL"}  ${r.encounter_id}${r.ok ? "" : "\n  - " + r.errors.join("\n  - ")}\n`);
      }
      process.exit(ok ? 0 : 1);
    }

    const saved = [];
    for (const e of items) {
      try {
        // The gate belongs here too: a scaffold can be hand-edited between
        // `encounter new` and `encounter save`, and an anchored first look
        // cannot be un-anchored after the fact.
        if (e.blind === false && Array.isArray(e.prior_encounters_shown) && e.prior_encounters_shown.length) {
          const pers = getPersona(e.persona_id);
          if (pers) {
            const runRec = e.run_id ? readRun(e.run_id) : null;
            const v = checkRecallRequest(pers, e.prior_encounters_shown, {
              artifact: e.artifact?.slug,
              project: e.artifact?.project || runRec?.artifact?.project,
            });
            if (!v.ok) die(`recall refused for ${e.encounter_id}:\n- ${v.errors.join("\n- ")}`);
          }
        }
        const rec = saveEncounter(e);
        // An encounter that names a run joins that run's lane automatically —
        // otherwise the link exists only in the direction nobody reads.
        if (rec.encounter.run_id) {
          try {
            attachEncounter(rec.encounter.run_id, rec.encounter.encounter_id,
              rec.encounter.blind ? "blind" : "debate");
          } catch (linkErr) {
            // The work is real and the persona may already be gone, so the
            // encounter is kept. But it must not be silently absorbed into a
            // panel that already closed: demote the pointer so the run_id
            // backlink cannot pull it into that run's report.
            unlinkEncounterRun(rec.path, linkErr.message);
            process.stderr.write(
              `persona: NOT part of ${rec.encounter.run_id} — ${linkErr.message}\n` +
              `persona: the encounter was kept and its run pointer demoted to unlinked_run_id.\n`
            );
          }
        }
        saved.push(rec);
      } catch (err) {
        die(`could not save ${e.encounter_id || "(unnamed)"}: ${err.message}`);
      }
    }
    if (flags.json) return out({ saved: saved.map((s) => ({ encounter_id: s.encounter.encounter_id, path: s.path })) }, true);
    saved.forEach((s) => process.stdout.write(`saved ${s.encounter.encounter_id}\n  ${s.path}\n`));
    return;
  }

  if (sub === "list") {
    const rows = listEncounters({ persona_id: rest[0], artifact: flags.artifact });
    if (flags.json) return out({ count: rows.length, encounters: rows }, true);
    if (!rows.length) return process.stdout.write(`No encounters yet.\nStore: ${encountersDir()}\n`);
    for (const e of rows) {
      const n = (e.findings || []).length;
      const un = (e.unanswered || []).length;
      process.stdout.write(
        `${e.encounter_id}\n  ${e.persona_id} met ${e.artifact.label}${e.artifact.version ? ` @ ${e.artifact.version}` : ""}` +
        ` — ${e.blind ? "blind" : "informed"}, ${e.started_at.slice(0, 10)}\n` +
        `  ${n} finding${n === 1 ? "" : "s"}, ${un} unanswered, viewports: ${(e.conditions?.viewports || []).join(", ")}\n`
      );
    }
    return;
  }

  if (sub === "show") {
    const e = getEncounter(rest[0]);
    if (!e) die(`encounter not found: ${rest[0] || "(none)"}`);
    if (flags.json) return out(e, true);
    process.stdout.write(`${JSON.stringify(e, null, 2)}\n`);
    return;
  }

  die("usage: persona encounter <new|save|validate|list|show> ...");
}

// --- runs: a panel as a durable object ------------------------------------

function cmdRun(positional, flags) {
  const [sub, ...rest] = positional;

  if (sub === "new") {
    const request = rest.join(" ").trim();
    if (!request) die('usage: persona run new "<request>" --artifact <slug> [--label ".."] [--version ".."] [--personas id1,id2] [--level low|medium|high]');
    if (!flags.artifact) die("--artifact <slug> is required");
    if (!flags.version) die("--version <v> is required — freeze the artifact before a panel sees it");
    const roster = flags.personas ? String(flags.personas).split(",").map((x) => x.trim()).filter(Boolean) : [];
    if (!roster.length) die("--personas id1,id2 is required — a run records who was on the panel");
    for (const id of roster) if (!getPersona(id)) die(`persona not found in the library: ${id}`);

    let run;
    try {
      run = createRun({
        request,
        artifact: { slug: flags.artifact, label: flags.label || flags.artifact, url: flags.url, version: flags.version, frozen: true },
        roster,
        level: flags.level,
      });
    } catch (e) {
      die(e.message);
    }
    if (flags.json) return out(run, true);
    process.stdout.write(`opened ${run.run_id}\n  ${runDir(run.run_id)}\n  ${roster.length} personas on ${run.artifact.label} @ ${run.artifact.version}\n\nEach persona writes its encounter with --run ${run.run_id}\n`);
    return;
  }

  if (sub === "list") {
    const rows = listRuns({ artifact: flags.artifact, status: flags.status });
    if (flags.json) return out({ count: rows.length, runs: rows }, true);
    if (!rows.length) return process.stdout.write(`No runs yet.\nStore: ${runsDir()}\n`);
    for (const r of rows) {
      const n = (r.lanes || []).reduce((a, l) => a + (l.encounter_ids || []).length, 0);
      process.stdout.write(
        `${r.run_id}  [${r.status}]\n  ${r.artifact.label}${r.artifact.version ? ` @ ${r.artifact.version}` : ""} — ${r.started_at.slice(0, 10)}\n` +
        `  ${(r.roster || []).length} personas, ${n} encounters, ${(r.unanswered || []).length} unanswered\n  ${r.request.slice(0, 90)}\n`
      );
    }
    return;
  }

  if (sub === "show") {
    const r = readRun(rest[0]);
    if (!r) die(`run not found: ${rest[0] || "(none)"}`);
    if (flags.json) return out({ ...r, encounters: runEncounters(r) }, true);
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    return;
  }

  if (sub === "report") {
    const r = readRun(rest[0]);
    if (!r) die(`run not found: ${rest[0] || "(none)"}`);
    const file = writeReport(r);
    if (flags.json) return out({ run_id: r.run_id, report: file }, true);
    process.stdout.write(`${file}\n`);
    return;
  }

  if (sub === "lesson") {
    const id = rest[0];
    if (!id) die('usage: persona run lesson <run_id> --verdict valuable|mixed|wasted [--changed ".."] [--landed "a;b"] [--worked "a;b"] [--failed "a;b"] [--reuse-roster|--no-reuse-roster]');
    const list = (v) => (v && v !== true ? String(v).split(";").map((x) => x.trim()).filter(Boolean) : undefined);
    const outcome = {};
    if (flags.verdict) outcome.verdict = String(flags.verdict);
    if (flags.changed && flags.changed !== true) outcome.what_changed = String(flags.changed);
    if (list(flags.landed)) outcome.landed = list(flags.landed);
    if (list(flags.worked)) outcome.method_worked = list(flags.worked);
    if (list(flags.failed)) outcome.method_failed = list(flags.failed);
    if (flags["reuse-roster"]) outcome.reuse_roster = true;
    if (flags["no-reuse-roster"]) outcome.reuse_roster = false;

    let r;
    try {
      r = recordOutcome(id, outcome);
    } catch (e) {
      die(e.message);
    }
    const file = writeReport(r);
    if (flags.json) return out({ run_id: r.run_id, outcome: r.outcome, report: file }, true);
    process.stdout.write(`recorded ${r.outcome.verdict} on ${r.run_id}\n  ${file}\n`);
    return;
  }

  if (sub === "proven") {
    const rows = provenRosters();
    if (flags.json) return out({ count: rows.length, rosters: rows }, true);
    if (!rows.length) return process.stdout.write("No run has been marked valuable yet.\nRecord one with `persona run lesson <run_id> --verdict valuable --changed \"...\"`.\n");
    for (const r of rows) {
      process.stdout.write(
        `${r.run_id}  [${r.verdict}]\n  ${r.artifact} — ${String(r.when).slice(0, 10)}\n` +
        `  ${r.what_changed || "(no change recorded)"}\n` +
        `  roster: ${r.roster.join(", ")}\n` +
        (r.method_worked.length ? `  worked: ${r.method_worked.join("; ")}\n` : "")
      );
    }
    return;
  }

  if (sub === "close") {
    const id = rest[0];
    if (!id) die("usage: persona run close <run_id> [--synthesis <file|-|text>] [--abandoned]");
    let synthesis;
    if (flags.synthesis && flags.synthesis !== true) {
      const v = String(flags.synthesis);
      synthesis = (v === "-" || existsSync(v)) ? readInputFile(v === "-" ? undefined : v) : v;
    }
    let r;
    try {
      r = closeRun(id, { synthesis, status: flags.abandoned ? "abandoned" : "closed" });
    } catch (e) {
      die(e.message);
    }
    const file = writeReport(r);
    if (flags.json) return out({ run_id: r.run_id, status: r.status, unanswered: r.unanswered, report: file }, true);
    process.stdout.write(`${r.status} ${r.run_id}\n  ${file}\n  ${(r.unanswered || []).length} unanswered carried forward\n`);
    return;
  }

  die("usage: persona run <new|list|show|report|close|lesson|proven> ...");
}

// --- recall: what a persona is allowed to bring with it --------------------

function cmdRecall(positional, flags) {
  const id = positional[0];
  if (!id) die('usage: persona recall <persona_id> [--artifact <slug>] [--project <name>] [--limit N] [--json]');
  const persona = getPersona(id);
  if (!persona) die(`persona not found: ${id}`);

  const pack = buildRecallBriefing(persona, {
    artifact: flags.artifact,
    project: flags.project,
    limit: Number.parseInt(flags.limit || "6", 10) || 6,
  });
  if (flags.json) return out(pack, true);
  process.stdout.write(renderRecallBriefing(pack));
  if (pack.recall !== "none" && pack.included) {
    process.stderr.write(
      `\nPass these to an informed dispatch:\n  --informed ${pack.encounter_ids.join(",")}\n`
    );
  }
}

function usage() {
  process.stdout.write(
    [
      "persona — task-specific persona panels + a recallable persona library",
      "Planning commands prepare text/JSON; the LLM host executes reviews. This CLI makes no model calls.",
      "",
      '  persona brief <handoff|interface|decision> --artifact <locator@version> --question <text>',
      '    [--constraints text] [--mode single|panel] [--personas id1,id2] [--json]',
      '    Default: one reviewer; panel: three. Saved references never add reviewers. No writes.',
      '  persona new "<brief>" [--count N] [--roster <name>] [--json]',
      "  persona save <file|->            persona validate <file|-> [--strict]",
      "  persona list [--tag t] [--role r] [--status s] [--json]",
      '  persona show <id> [--json]       persona search "<query>" [--json]',
      "  persona rm <id>                  persona archive <id>",
      "  persona roster save <name> --lenses a,b,c [--personas ids] [--use-case ..] [--desc ..]",
      "  persona roster list | show <name> | rm <name> | lenses",
      '  persona panel "<topic>" [--roster <name> | --auto] [--level low|medium|high] [--count N] [--json]',
      '    Counts: low 3–4, medium 4–6, high 6–8; incompatible explicit counts are rejected.',
      "  persona encounter new <persona_id> --artifact <slug> [--label ..] [--version ..] [--informed ids]",
      "  persona encounter save <file|-> | validate <file|-> | list [<persona_id>] | show <encounter_id>",
      '  persona run new "<request>" --artifact <slug> --version <v> --personas id1,id2',
      "  persona run list | show <run_id> | report <run_id> | close <run_id> [--synthesis <file|->]",
      "  persona run lesson <run_id> --verdict valuable|mixed|wasted --changed \"..\" [--worked \"a;b\"]",
      "  persona run proven                 persona roster from-run <run_id> --name \"..\"",
      "  persona recall <persona_id> [--artifact <slug>] [--project <name>] [--limit N]",
      "  persona home",
      "  persona archetypes [query] [--defaults] [--json]",
      "  persona compose <archetype,archetype> [--specialties a/b,c/d] [--task ..] [--save]",
      '  persona consult "<task>" [--mode ui-ux] [--archetypes a,b] [--specialties a/b,c/d]',
      "  persona sources <status|scan|ingest|search|verify|principles> [--root <corpus-root>]",
      "",
      `Library: ${libraryHome()}`,
      "",
      "This method is largely unvalidated — see docs/LIMITATIONS.md before",
      "treating panel output as established. Hypothesis, not validation.",
    ].join("\n") + "\n"
  );
}

// --- dispatch --------------------------------------------------------------

function main() {
  const [, , cmd, ...rest] = process.argv;
  const options = cmd === 'brief'
    ? { artifact: 'value', question: 'value', constraints: 'value', mode: 'value', personas: 'value', json: 'boolean' }
    : cmd === 'panel' ? { roster: 'value', auto: 'boolean', level: 'value', count: 'value', json: 'boolean' } : null;
  const { positional, flags } = options ? parsePlanningArgs(rest, options) : parseArgs(rest);

  switch (cmd) {
    case "archetypes": return cmdArchetypes(positional, flags);
    case "compose": return cmdCompose(positional, flags);
    case "consult": return cmdConsult(positional, flags);
    case "sources": return cmdSources(positional, flags);
    case "home": return cmdHome();
    case "brief": {
      const plan = createBriefPlan(positional, flags);
      if (flags.json) return out(plan, true);
      process.stdout.write(`CLI prepares this brief only; the host executes reviews. No model calls or writes.\n\n${plan.brief}\n`);
      return;
    }
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
    case "run": return cmdRun(positional, flags);
    case "recall": return cmdRecall(positional, flags);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return usage();
    default:
      die(`unknown command: ${cmd}\nRun 'persona help'.`, 2);
  }
}

try {
  main();
} catch (err) {
  if (process.env.PERSONA_DEBUG === "1") throw err;
  die(err && err.message ? err.message : String(err));
}
