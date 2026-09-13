/**
 * runs — a persona panel as a durable object.
 *
 * `personas.json` holds who a persona is. `encounters/` holds what one persona
 * saw in one sitting. Neither answers "what happened in that panel back in
 * June" — the run itself was never a thing you could open.
 *
 *   <libraryHome>/runs/<run_id>/run.json     the machine record
 *   <libraryHome>/runs/<run_id>/report.md    the readable one, generated
 *   <libraryHome>/runs/<run_id>/notes/       anything a human or agent adds
 *
 * Encounters stay indexed by persona, because a persona's history ACROSS runs is
 * the thing that makes a persona worth keeping. The run references them by id,
 * and each encounter carries `run_id` back, so history reads in both directions:
 * every persona in this panel, and every panel this persona sat on.
 *
 * A run is append-only in the way that matters: `status` advances forward
 * (open -> closed), a closed run refuses new encounters, and `report.md` is
 * regenerated from run.json rather than hand-edited.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { encounterMembershipProblem } from "./run-membership.mjs";
export { encounterMembershipProblem } from "./run-membership.mjs";
import { safeStorePath } from "./store-path.mjs";
import { withStoreLock } from "./store-lock.mjs";
import { listAdjudications, listDispatchReceipts } from "./review-evidence.mjs";
import { latestRecommendationPacket, listRecommendationPackets, renderRecommendationPacket } from "./recommendations.mjs";
import { verifyArtifact } from "./artifacts.mjs";
import { libraryHome } from "./library.mjs";
import { listEncounters, getEncounter } from "./encounters.mjs";
import { assertIdSegment } from "./idpath.mjs";

export const RUN_SCHEMA_VERSION = "1.0.0";
const SUPPORTED = ["1.0.0"];
const STATUSES = ["open", "closed", "abandoned"];
const LANES = ["blind", "debate", "adjudication"];
const VERDICTS = ["valuable", "mixed", "wasted"];

export function runsDir() {
  return path.join(libraryHome(), "runs");
}

export function runDir(runId) {
  assertIdSegment("run_id", runId, {
    missingClause: "the record names no run, so there is no folder to file it under.",
  });
  return safeStorePath("runs", runId);
}

function slugify(v, fallback = "run") {
  const s = String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

function atomicWrite(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, file);
}

export function runId(artifactSlug, isoDate) {
  const day = (isoDate || new Date().toISOString()).slice(0, 10);
  return `run_${slugify(artifactSlug, "artifact")}_${day}_${randomBytes(3).toString("hex")}`;
}

export function validateRun(r) {
  const errors = [];
  const req = (c, m) => { if (!c) errors.push(m); };
  const isStr = (v) => typeof v === "string" && v.trim().length > 0;

  if (!r || typeof r !== "object" || Array.isArray(r)) {
    return { ok: false, errors: ["run must be a JSON object"] };
  }
  req(SUPPORTED.includes(r.schema_version), `schema_version must be one of ${SUPPORTED.join(", ")}`);
  req(isStr(r.run_id), "run_id is required");
  req(isStr(r.request), "request is required — one sentence on what the panel was asked to judge");
  req(isStr(r.started_at), "started_at is required (ISO 8601)");
  req(STATUSES.includes(r.status), `status must be one of ${STATUSES.join(", ")}`);

  if (!r.artifact || typeof r.artifact !== "object") {
    errors.push("artifact is required (object with slug + label)");
  } else {
    req(isStr(r.artifact.slug), "artifact.slug is required");
    req(isStr(r.artifact.label), "artifact.label is required");
    // The freeze rule, enforced where the run is recorded rather than only in prose.
    if (r.artifact.frozen === true && !isStr(r.artifact.version)) {
      errors.push("artifact.version is required when artifact.frozen is true");
    }
    if (r.artifact.frozen !== true) {
      errors.push("artifact.frozen must be true — freeze and version the artifact before a panel sees it");
    }
  }

  if (r.artifact?.manifest && (typeof r.artifact.manifest !== "object" || !/^[a-f0-9]{64}$/.test(r.artifact.manifest.sha256 || ""))) errors.push("artifact.manifest requires a SHA-256 identity");
  if (!Array.isArray(r.roster) || r.roster.length === 0) {
    errors.push("roster must list at least one persona_id");
  } else if (r.roster.some(id => !isStr(id)) || new Set(r.roster).size !== r.roster.length) errors.push("roster must contain distinct nonempty persona IDs");
  if (r.lanes !== undefined) {
    if (!Array.isArray(r.lanes)) errors.push("lanes must be an array");
    else r.lanes.forEach((l, i) => {
      if (!l || typeof l !== "object") return errors.push(`lanes[${i}] must be an object`);
      req(LANES.includes(l.kind), `lanes[${i}].kind must be one of ${LANES.join(", ")}`);
      if (l.encounter_ids !== undefined && !Array.isArray(l.encounter_ids)) {
        errors.push(`lanes[${i}].encounter_ids must be an array`);
      }
    });
    // Order is the whole safety property: a debate that runs before any blind
    // pass destroys the only unanchored reaction the panel will ever get.
    const kinds = r.lanes.map((l) => l && l.kind);
    const firstBlind = kinds.indexOf("blind");
    const firstDebate = kinds.indexOf("debate");
    if (firstDebate !== -1 && (firstBlind === -1 || firstDebate < firstBlind)) {
      errors.push("a debate lane cannot precede a blind lane — blind passes run first and are saved");
    }
  }
  if (r.unanswered !== undefined && !Array.isArray(r.unanswered)) {
    errors.push("unanswered must be an array of strings");
  }
  if (r.outcome !== undefined) {
    if (typeof r.outcome !== "object" || Array.isArray(r.outcome)) {
      errors.push("outcome must be an object");
    } else {
      req(VERDICTS.includes(r.outcome.verdict), `outcome.verdict must be one of ${VERDICTS.join(", ")}`);
      req(isStr(r.outcome.recorded_at), "outcome.recorded_at is required");
      // "It was valuable" without naming what changed is a compliment, not a
      // lesson — and it is the claim most likely to be wrong later.
      if (r.outcome.verdict === "valuable" && !isStr(r.outcome.what_changed)) {
        errors.push('outcome.what_changed is required when verdict is "valuable" — name what changed, or the verdict is unfalsifiable');
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function assertValidRun(r) {
  const { ok, errors } = validateRun(r);
  if (!ok) throw new Error(`Invalid run:\n- ${errors.join("\n- ")}`);
  return true;
}

export function readRun(id) {
  const file = safeStorePath("runs", id, "run.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function writeRun(r) {
  assertValidRun(r);
  assertIdSegment("run_id", r.run_id);
  atomicWrite(safeStorePath("runs", r.run_id, "run.json"), `${JSON.stringify(r, null, 2)}\n`);
  return r;
}

export function createRun({ request, artifact = {}, roster = [], level, notes }) {
  if (artifact.manifest) {
    const result = verifyArtifact(artifact.manifest);
    if (!result.ok) throw new Error(`artifact snapshot failed verification: ${result.errors.join('; ')}`);
  }
  const started_at = new Date().toISOString();
  const id = runId(artifact.slug, started_at);
  const run = {
    schema_version: RUN_SCHEMA_VERSION,
    run_id: id,
    request: request || "",
    artifact: {
      slug: artifact.slug || "",
      label: artifact.label || artifact.slug || "",
      ...(artifact.url ? { url: artifact.url } : {}),
      ...(artifact.version ? { version: artifact.version } : {}),
      ...(artifact.manifest ? { manifest: artifact.manifest } : {}),
      integrity: artifact.manifest ? "snapshot" : "declared",
      frozen: artifact.frozen !== false,
    },
    roster,
    ...(level ? { level } : {}),
    lanes: [],
    status: "open",
    started_at,
    unanswered: [],
    ...(notes ? { notes } : {}),
  };
  writeRun(run);
  mkdirSync(path.join(runDir(id), "notes"), { recursive: true });
  return run;
}

export function listRuns({ artifact, status } = {}) {
  const root = runsDir();
  if (!existsSync(root)) return [];
  return readdirSync(root)
    // A stray entry (e.g. a dotfile, or a name that fails the same id-segment
    // rule readRun -> runDir now enforces) must degrade to "not a run" here,
    // the same way a corrupt run.json already does, not throw and brick
    // every run in the store.
    .map((d) => {
      try {
        return readRun(d);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((r) => (!artifact || r.artifact?.slug === artifact))
    .filter((r) => (!status || r.status === status))
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
}

/** Resolve the run's encounters from the persona-indexed store. */
export function runEncounters(run) {
  const wanted = new Set((run.lanes || []).flatMap((l) => l.encounter_ids || []));
  const all = listEncounters({ artifact: run.artifact?.slug }).filter(e => !encounterMembershipProblem(run,e));
  const byId = new Map(all.map((e) => [e.encounter_id, e]));
  // Prefer explicit lane membership; fall back to run_id backlinks so an
  // encounter that recorded its run still surfaces if the lane was not updated.
  const linked = all.filter((e) => e.run_id === run.run_id);
  const out = [];
  const seen = new Set();
  for (const id of wanted) {
    const e = byId.get(id) || linked.find((x) => x.encounter_id === id);
    if (e && !seen.has(e.encounter_id)) { seen.add(e.encounter_id); out.push(e); }
  }
  for (const e of run.status === "open" ? linked : []) {
    if (!seen.has(e.encounter_id)) { seen.add(e.encounter_id); out.push(e); }
  }
  return out;
}

// Serialize read/modify/write, including close, to prevent lost attachments.
// Do not reclaim a stale lock automatically: a paused writer may still own it.
function mutateRun(id, update) {
  if (!readRun(id)) throw new Error(`run not found: ${id}`);
  return withStoreLock(path.join(runDir(id), 'mutation.lock'), () => {
    const run = readRun(id);
    if (!run) throw new Error(`run not found: ${id}`);
    return writeRun(update(run));
  });
}

export function attachEncounter(runIdStr, encounterId, kind = "blind") {
  if (!readRun(runIdStr)) throw new Error(`run not found: ${runIdStr}`);
  return mutateRun(runIdStr, run => {
    if (run.status !== 'open') throw new Error(`run ${runIdStr} is ${run.status}; open a new run for another encounter`);
    const e = getEncounter(encounterId);
    const problem = encounterMembershipProblem(run, e);
    if (problem) throw new Error(problem);
    if (kind !== (e.blind ? 'blind' : 'debate')) throw new Error('lane does not match encounter blind state');
    run.lanes ||= [];
    let lane = run.lanes.find(l => l.kind === kind);
    if (!lane) { lane = {kind, encounter_ids: []}; run.lanes.push(lane); }
    if (!lane.encounter_ids.includes(encounterId)) lane.encounter_ids.push(encounterId);
    return run;
  });
}

export function closeRun(runIdStr, { synthesis, unanswered, status = "closed" } = {}) {
  return mutateRun(runIdStr, run => {
  if (run.status !== "open") throw new Error(`run ${runIdStr} is already ${run.status}`);
  const accepted = runEncounters(run);
  for (const e of accepted) {
    const kind=e.blind ? 'blind' : 'debate';
    let lane=run.lanes.find(l=>l.kind===kind);
    if (!lane) {lane={kind,encounter_ids:[]};run.lanes.push(lane);}
    if (!lane.encounter_ids.includes(e.encounter_id)) lane.encounter_ids.push(e.encounter_id);
  }
  run.status = status;
  run.ended_at = new Date().toISOString();
  if (synthesis) run.synthesis = synthesis;
  if (Array.isArray(unanswered)) run.unanswered = unanswered;
  else {
    // Pool what every persona could not settle — that is next dispatch's agenda.
    const pooled = runEncounters(run).flatMap((e) => e.unanswered || []);
    run.unanswered = [...new Set([...(run.unanswered || []), ...pooled])];
  }
  return run;
  });
}

/**
 * Record what a panel produced. This is a lesson ABOUT the run — never a
 * reconstruction of what a persona saw. Encounters are the only record of that,
 * and a persona that did not write one has no memory to recover.
 */
export function recordOutcome(runIdStr, outcome = {}) {
  return mutateRun(runIdStr, run => {
  run.outcome = {
    ...(run.outcome || {}),
    ...outcome,
    recorded_at: new Date().toISOString(),
  };
  return run;
  });
}

/** Rosters that earned another run, newest first. */
export function provenRosters() {
  return listRuns()
    .filter((r) => r.outcome?.reuse_roster === true || r.outcome?.verdict === "valuable")
    .map((r) => ({
      run_id: r.run_id,
      artifact: r.artifact?.label || r.artifact?.slug,
      roster: r.roster || [],
      verdict: r.outcome?.verdict,
      what_changed: r.outcome?.what_changed,
      method_worked: r.outcome?.method_worked || [],
      when: r.started_at,
    }));
}

// --- report ----------------------------------------------------------------

function esc(s) {
  return String(s ?? "").replace(/\r/g, "");
}

/**
 * Generate report.md from run.json + the encounters. Regenerated, never
 * hand-edited: the JSON is the record, the markdown is the reading of it.
 * Verbatim is reproduced in full and never trimmed.
 */
export function renderReport(run) {
  const encs = runEncounters(run);
  const L = [];
  const a = run.artifact || {};

  L.push(`# Persona panel — ${esc(a.label || a.slug)}`);
  L.push("");
  L.push(`> Hypothesis, not validation. Synthetic personas, not real-user evidence.`);
  L.push(`> No task-success or timing data: these are simulated participants giving`);
  L.push(`> reactions, not recruited users completing tasks under observation.`);
  L.push("");
  L.push(`**Request** — ${esc(run.request)}`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Run | \`${run.run_id}\` |`);
  L.push(`| Artifact | ${esc(a.label)}${a.version ? ` @ \`${esc(a.version)}\`` : ""}${a.frozen ? " (frozen)" : ""} |`);
  if (a.url) L.push(`| URL | ${esc(a.url)} |`);
  L.push(`| Input integrity | ${a.manifest ? `snapshot digest ${a.manifest.sha256}; ${verifyArtifact(a.manifest).ok ? 'bytes verified' : 'snapshot missing or changed'}` : 'declared freeze only; no byte snapshot recorded'} |`);
  L.push(`| Roster | ${(run.roster || []).length} personas |`);
  L.push(`| Lanes | ${(run.lanes || []).map((l) => `${l.kind} (${(l.encounter_ids || []).length})`).join(", ") || "none"} |`);
  L.push(`| Status | ${run.status}${run.ended_at ? ` — ${run.ended_at.slice(0, 10)}` : ""} |`);
  L.push("");

  if (run.outcome) {
    const o = run.outcome;
    L.push("## What this panel produced");
    L.push("");
    L.push(`**${o.verdict}**${o.what_changed ? ` — ${esc(o.what_changed)}` : ""}`);
    L.push("");
    if (o.landed?.length) {
      L.push("Findings that led to a real change:");
      for (const f of o.landed) L.push(`- ${esc(f)}`);
      L.push("");
    }
    if (o.method_worked?.length) {
      L.push("What worked about the method:");
      for (const m of o.method_worked) L.push(`- ${esc(m)}`);
      L.push("");
    }
    if (o.method_failed?.length) {
      L.push("What broke:");
      for (const m of o.method_failed) L.push(`- ${esc(m)}`);
      L.push("");
    }
    if (o.reuse_roster === true) L.push("_This roster is worth running again._");
    if (o.reuse_roster === false) L.push("_Do not reuse this roster as composed._");
    L.push("");
  }

  if (run.synthesis) {
    L.push("## Synthesis");
    L.push("");
    L.push(esc(run.synthesis));
    L.push("");
  }

  // Real defects first — confirmed or reclassified, never the raw report.
  const findings = encs.flatMap((e) => (e.findings || []).map((f,i) => ({ ...f, finding_id:f.finding_id || `finding-${i+1}`, encounter_id:e.encounter_id, persona_id: e.persona_id })));
  // A preference is not a defect awaiting verification — it is a position, and
  // it is already true for the persona who holds it. Filing it under "unverified
  // defects" is the exact conflation the method exists to prevent.
  const isDefectLike = (f) => f.kind === "defect" || f.kind === "confusion";
  const positions = findings.filter((f) => !isDefectLike(f));
  const raw = findings.filter(isDefectLike);
  if (raw.length) {
    L.push("## Reported findings — reviewer assertions", "");
    L.push("Raw verified labels are historical reviewer assertions. Evidence-backed adjudication is recorded separately below.", "");
    for (const f of raw) L.push(`- ${esc(f.claim)} — ${f.kind} · ${f.encounter_id}/${f.finding_id} · ${f.persona_id} · reviewer label: ${f.verified || 'unverified'}`);
    L.push("");
  }
  const adjudications = listAdjudications(run.run_id);
  if (adjudications.length) {
    L.push('## Adjudication history', '', 'Source confirmation establishes only the named claim; it does not validate audience impact. Records retain their timestamps and correction links.', '');
    for (const item of adjudications) {
      L.push(`- ${item.adjudication_id}: **${item.disposition}** · ${item.encounter_id}/${item.finding_id} · ${esc(item.author)} · artifact ${esc(item.artifact_version)}`);
      if (item.verification_note) L.push(`  - Claim checked: ${esc(item.verification_note)}`);
      if (item.evidence_locator) L.push(`  - Evidence: ${esc(item.evidence_locator)}`);
      if (item.correction_of) L.push(`  - Corrects: ${item.correction_of}`);
      for (const change of item.accepted_changes || []) L.push(`  - Accepted edit: ${esc(change.path)} (${change.before_sha256} → ${change.after_sha256})`);
    }
    L.push('');
  }
  // Recommendations come after adjudication, so they render above the raw
  // dispatch evidence: a reader wants the addressed work before the provenance.
  const packets = listRecommendationPackets(run.run_id);
  const latest = latestRecommendationPacket(run.run_id);
  if (latest) {
    L.push(...renderRecommendationPacket(latest));
    if (packets.length > 1) {
      L.push(`_${packets.length} packets recorded; the latest is shown. Earlier rounds: ${packets.slice(0, -1).map((p) => `\`${p.packet_id}\` (round ${p.iteration?.round ?? 1})`).join(", ")}._`);
      L.push("");
    }
  }
  const dispatches = listDispatchReceipts(run.run_id);
  L.push('## Dispatch evidence', '');
  if (!dispatches.length) L.push('No dispatch receipts recorded; context isolation, model and usage are unknown.', '');
  for (const d of dispatches) {
    L.push(`- ${d.receipt_id}: ${d.activity} · child ${esc(d.child_id)} · ${d.provenance} · context ${esc(d.context_mode)} · model ${esc(d.model ?? 'unknown')} · encounter ${d.encounter_id || 'not linked'}`);
    L.push(`  - Input/output tokens: ${d.usage.input_tokens ?? 'unknown'}/${d.usage.output_tokens ?? 'unknown'}; prompt ${d.prompt_sha256}; profile ${d.profile_sha256}`);
    if (d.packet_sha256) L.push(`  - Packet: ${d.packet_sha256}`);
    if (d.evidence_locator) L.push(`  - Host evidence locator (declared): ${esc(d.evidence_locator)}`);
  }

  if (positions.length) {
    L.push("## Positions — preferences, praise, and requests");
    L.push("");
    L.push("Not defects. These need a decision, not a verification, and they are where a panel usually disagrees with itself.");
    L.push("");
    for (const f of positions) {
      L.push(`- ${esc(f.claim)} — ${f.kind}${f.viewport ? `, ${f.viewport}` : ""} · \`${f.persona_id}\` · ${f.encounter_id}/${f.finding_id}`);
      if (f.quote) L.push(`  - > ${esc(f.quote)}`);
    }
    L.push("");
  }

  L.push("## What each persona actually said");
  L.push("");
  L.push("`verbatim` is authoritative and is reproduced unedited. Structured findings above are a lossy extraction from it.");
  L.push("");
  for (const e of encs) {
    L.push(`### ${e.persona_id}`);
    L.push("");
    L.push(`\`${e.encounter_id}\` · ${e.blind ? "blind" : "informed"}${!e.blind && e.prior_encounters_shown?.length ? ` (shown: ${e.prior_encounters_shown.join(", ")})` : ""} · ${(e.conditions?.viewports || []).join(", ")}`);
    L.push("");
    L.push("> " + esc(e.verbatim).split("\n").join("\n> "));
    L.push("");
    if (e.outcome?.verdict) L.push(`Verdict: **${e.outcome.verdict}**`);
    if (e.decisions?.length) {
      L.push("");
      for (const d of e.decisions) L.push(`- ${esc(d.action)} — ${esc(d.rationale)}${d.gave_up ? " *(gave up)*" : ""}`);
    }
    L.push("");
  }

  if (run.unanswered?.length) {
    L.push("## Unanswered — ask these in the first dispatch next time");
    L.push("");
    L.push("Follow-up availability depends on the host. These questions carry forward in durable records.");
    L.push("");
    for (const q of run.unanswered) L.push(`- ${esc(q)}`);
    L.push("");
  }

  if (!encs.length) {
    L.push("_No encounters attached yet. Personas write theirs before returning._");
    L.push("");
  }

  return L.join("\n");
}

export function writeReport(run) {
  const md = renderReport(run);
  const file = path.join(runDir(run.run_id), "report.md");
  atomicWrite(file, md.endsWith("\n") ? md : `${md}\n`);
  return file;
}
