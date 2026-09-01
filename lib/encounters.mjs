/**
 * encounters — what a persona has SEEN, as files.
 *
 * `personas.json` holds who a persona is. This holds what it met. Both live in
 * the global library, so a persona recalled from any repo carries its history.
 *
 *   <libraryHome>/encounters/<persona_id>/<persona_id>--<slug>--<date>--<n>.json
 *
 * Written by the persona BEFORE it returns. A subagent becomes eviction-eligible
 * ~30s after finishing, so a return value is not a durable record; the file is.
 * See docs/persona-memory.md.
 */

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { libraryHome, listPersonas } from "./library.mjs";
import { pathSegmentProblem, assertIdSegment } from "./idpath.mjs";

export const ENCOUNTER_SCHEMA_VERSION = "1.0.0";
const SUPPORTED_SCHEMA_VERSIONS = ["1.0.0"];

const KINDS = ["defect", "confusion", "praise", "preference", "request"];
const SEVERITIES = ["blocking", "major", "minor", "cosmetic"];
const VERIFIED = ["unverified", "confirmed", "refuted", "reclassified"];
const VERDICTS = ["succeeds", "partly", "fails"];

export function encountersDir() {
  return path.join(libraryHome(), "encounters");
}

export function personaEncounterDir(personaId) {
  assertIdSegment("persona_id", personaId, {
    missingClause: "the record names no persona, so there is no folder to file it under.",
  });
  return path.join(encountersDir(), personaId);
}

function slugify(value, fallback = "artifact") {
  const s = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

function atomicWrite(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, filePath);
}

/** encounter_id: enc_<persona-slug>_<artifact-slug>_<date>_<hex6> */
export function encounterId(personaId, artifactSlug, isoDate) {
  const day = (isoDate || new Date().toISOString()).slice(0, 10);
  return `enc_${slugify(personaId, "persona")}_${slugify(artifactSlug)}_${day}_${randomBytes(3).toString("hex")}`;
}

/**
 * Validate an encounter. Returns { ok, errors }.
 * Deliberately strict on the five fields the method depends on: verbatim,
 * blind, conditions.viewports, findings[].kind, findings[].verified.
 */
export function validateEncounter(e) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  const isStr = (v) => typeof v === "string" && v.trim().length > 0;
  const isArr = (v) => Array.isArray(v);

  if (!e || typeof e !== "object" || Array.isArray(e)) {
    return { ok: false, errors: ["encounter must be a JSON object"] };
  }

  req(SUPPORTED_SCHEMA_VERSIONS.includes(e.schema_version),
    `schema_version must be one of ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`);
  req(isStr(e.encounter_id), "encounter_id is required");
  req(isStr(e.persona_id), "persona_id is required");
  // A persona_id that passes "non-empty string" can still be unusable as the
  // folder name it becomes at save time — catch that here too, so
  // `encounter validate` reports the same defect `saveEncounter` refuses.
  if (isStr(e.persona_id)) {
    const reason = pathSegmentProblem(e.persona_id);
    if (reason) errors.push(`persona_id is not a usable identifier: ${reason}`);
  }
  if (e.run_id !== undefined && !isStr(e.run_id)) errors.push("run_id, if present, must be a string");
  req(isStr(e.started_at), "started_at is required (ISO 8601)");

  // artifact — the thing that was met, and whether it was frozen
  if (!e.artifact || typeof e.artifact !== "object") {
    errors.push("artifact is required (object with slug + label)");
  } else {
    req(isStr(e.artifact.slug), "artifact.slug is required");
    req(isStr(e.artifact.label), "artifact.label is required");
    if (e.artifact.frozen === true && !isStr(e.artifact.version)) {
      errors.push("artifact.version is required when artifact.frozen is true");
    }
  }

  // blind — never inferred, always declared
  req(typeof e.blind === "boolean", "blind is required and must be true or false");
  if (e.blind === false) {
    req(isArr(e.prior_encounters_shown) && e.prior_encounters_shown.length > 0,
      "an informed read (blind: false) must list prior_encounters_shown");
  }
  if (e.blind === true && isArr(e.prior_encounters_shown) && e.prior_encounters_shown.length > 0) {
    errors.push("a blind read cannot list prior_encounters_shown");
  }

  // conditions — a finding without a viewport is not a finding
  if (!e.conditions || typeof e.conditions !== "object") {
    errors.push("conditions is required (object with viewports[])");
  } else {
    req(isArr(e.conditions.viewports) && e.conditions.viewports.length > 0,
      "conditions.viewports is required and must list at least one viewport");
  }

  // verbatim — authoritative, never summarised
  req(isStr(e.verbatim), "verbatim is required and is never summarised");

  if (e.findings !== undefined) {
    if (!isArr(e.findings)) errors.push("findings must be an array");
    else e.findings.forEach((f, i) => {
      const at = `findings[${i}]`;
      if (!f || typeof f !== "object") return errors.push(`${at} must be an object`);
      req(KINDS.includes(f.kind), `${at}.kind must be one of ${KINDS.join(", ")}`);
      req(isStr(f.claim), `${at}.claim is required`);
      if (f.severity !== undefined) req(SEVERITIES.includes(f.severity), `${at}.severity must be one of ${SEVERITIES.join(", ")}`);
      if (f.verified !== undefined) req(VERIFIED.includes(f.verified), `${at}.verified must be one of ${VERIFIED.join(", ")}`);
      if (f.verified === "reclassified" && !isStr(f.verification_note)) {
        errors.push(`${at}.verification_note is required when verified is "reclassified"`);
      }
    });
  }

  if (e.decisions !== undefined) {
    if (!isArr(e.decisions)) errors.push("decisions must be an array");
    else e.decisions.forEach((d, i) => {
      if (!d || typeof d !== "object") return errors.push(`decisions[${i}] must be an object`);
      req(isStr(d.action), `decisions[${i}].action is required`);
      req(isStr(d.rationale), `decisions[${i}].rationale is required`);
    });
  }

  if (e.unanswered !== undefined && !isArr(e.unanswered)) errors.push("unanswered must be an array of strings");
  if (e.outcome !== undefined) {
    if (typeof e.outcome !== "object") errors.push("outcome must be an object");
    else if (e.outcome.verdict !== undefined && !VERDICTS.includes(e.outcome.verdict)) {
      errors.push(`outcome.verdict must be one of ${VERDICTS.join(", ")}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidEncounter(e) {
  const { ok, errors } = validateEncounter(e);
  if (!ok) throw new Error(`Invalid encounter:\n- ${errors.join("\n- ")}`);
  return true;
}

/**
 * Build the recovery hint for a persona_id refusal. Never invents an id —
 * an id this tool made up would file the encounter under a persona the
 * library cannot resolve, turning a loud refusal back into a silent loss.
 * It only points at a real, already-saved persona when the record itself
 * offers a name to check.
 */
function personaHint(e) {
  const candidates = [e.persona_name, e.persona?.name, e.persona?.id, e.artifact?.persona];
  const name = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  if (!name) return "Add persona_id, or run: persona list  — then use that persona's id.";

  let matches;
  try {
    matches = listPersonas().filter((p) => String(p.name).toLowerCase() === name.toLowerCase());
  } catch {
    // A corrupt personas.json must degrade the hint, never replace the
    // refusal itself with a different, more confusing error.
    return "Add persona_id, or run: persona list  — then use that persona's id.";
  }

  if (matches.length === 1) {
    return `Did you mean persona_id "${matches[0].id}"? It matches the name "${name}" on this record.`;
  }
  if (matches.length > 1) {
    return `The name "${name}" matches ${matches.length} personas: ${matches.map((p) => p.id).join(", ")}. Set persona_id to one of them.`;
  }
  return `The name "${name}" on this record matches no persona in the library. Save the persona first (persona save), then set persona_id.`;
}

/** Persist an encounter. Append-only: an existing encounter_id is never overwritten. */
export function saveEncounter(input) {
  // First thing that runs, before any id is derived and before disk is
  // touched — a refusal here must not leave a partially-derived encounter_id
  // behind, and must not be able to reach the write below it.
  assertIdSegment("persona_id", input?.persona_id, {
    missingClause: "the record names no persona, so there is no folder to file it under.",
    // Lazy: personaHint() reads and parses personas.json. Passed as a
    // zero-arg function so it only runs on the throw path — a valid save
    // (the common case, and the only one that matters for panel-sized
    // batches) must never pay for a hint it will never see.
    hint: () => personaHint(input || {}),
  });

  const e = { schema_version: ENCOUNTER_SCHEMA_VERSION, ...input };
  if (!e.encounter_id) {
    e.encounter_id = encounterId(e.persona_id, e.artifact?.slug, e.started_at);
  }
  assertValidEncounter(e);

  const existing = getEncounter(e.encounter_id);
  if (existing) {
    throw new Error(
      `encounter_id already recorded: ${e.encounter_id}\n  ${existing._path}\n` +
      "Encounters are append-only and never overwritten. A second look is a second " +
      "encounter — scaffold a fresh one with `persona encounter new`."
    );
  }

  const day = e.started_at.slice(0, 10);
  const base = `${slugify(e.persona_id, "persona")}--${slugify(e.artifact.slug)}--${day}`;
  const dir = personaEncounterDir(e.persona_id);
  mkdirSync(dir, { recursive: true });

  let n = 1;
  let file = path.join(dir, `${base}--${n}.json`);
  while (existsSync(file)) {
    n += 1;
    file = path.join(dir, `${base}--${n}.json`);
  }

  atomicWrite(file, `${JSON.stringify(e, null, 2)}\n`);
  return { path: file, encounter: e };
}

/**
 * Demote an encounter's run pointer. Used when a run refuses the link (it is
 * closed): the record is kept — a persona's verbatim is not discardable — but
 * `run_id` becomes `unlinked_run_id` so no run resolves it as a member.
 */
export function unlinkEncounterRun(file, reason) {
  try {
    const e = JSON.parse(readFileSync(file, "utf8"));
    if (!e.run_id) return false;
    e.unlinked_run_id = e.run_id;
    e.unlinked_reason = reason || "run refused the link";
    delete e.run_id;
    atomicWrite(file, `${JSON.stringify(e, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// A stray file directly under encounters/ (the exact shape of the reported
// bug: a bad persona_id wrote its record into the shared parent) is warned
// about once per path, not once per listEncounters() call — a hot read loop
// must not spam stderr for a problem the operator already saw the fix for.
const warnedStrayPaths = new Set();

function warnStray(absPath) {
  if (warnedStrayPaths.has(absPath)) return;
  warnedStrayPaths.add(absPath);
  process.stderr.write(
    `persona-lab: ignoring a stray file in the encounters root: ${absPath}\n` +
    "  An encounter must live under encounters/<persona_id>/. Move it into that\n" +
    "  persona's folder and set persona_id to match the folder name.\n"
  );
}

/** List encounters, newest first. Filter by persona_id and/or artifact slug. */
export function listEncounters({ persona_id, artifact } = {}) {
  const root = encountersDir();

  // Filtered by persona_id: validate BEFORE any existence check. A malformed
  // id must refuse the same way on a fresh store (encounters/ absent) as on
  // an established one — otherwise "that persona has no history" and "this
  // id cannot even name a folder" collapse into the same silent empty
  // result, decided by whether an unrelated directory happens to exist yet.
  if (persona_id) {
    const dir = personaEncounterDir(persona_id); // throws if persona_id is unusable
    const rows = [];
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        const e = readJson(path.join(dir, f));
        if (!e) continue;
        if (artifact && e.artifact?.slug !== artifact) continue;
        rows.push({ ...e, _path: path.join(dir, f) });
      }
    }
    return rows.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  }

  if (!existsSync(root)) return [];

  // Unfiltered: the root may hold a stray file left by the exact bug this
  // guard now prevents at write time. Only recurse into real directories;
  // name and skip anything else instead of letting `readdirSync` on a file
  // throw ENOTDIR and brick every read.
  const rows = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = path.join(root, entry.name);
    if (!entry.isDirectory()) {
      warnStray(abs);
      continue;
    }
    let files;
    try {
      files = readdirSync(abs);
    } catch {
      // One unreadable persona folder must not brick every other read.
      continue;
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const e = readJson(path.join(abs, f));
      if (!e) continue;
      if (artifact && e.artifact?.slug !== artifact) continue;
      rows.push({ ...e, _path: path.join(abs, f) });
    }
  }
  return rows.sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
}

export function getEncounter(id) {
  return listEncounters().find((e) => e.encounter_id === id) || null;
}

/**
 * Scaffold an encounter for a persona to fill in before it returns.
 * `blind` defaults to true: a blind read is the default, an informed read is
 * a deliberate choice that must name the prior encounters it was shown.
 */
export function scaffoldEncounter({ persona_id, run_id, artifact = {}, blind = true, prior = [], viewports = ["desktop-1440", "phone-390"], driver, time_budget }) {
  const started_at = new Date().toISOString();
  const e = {
    schema_version: ENCOUNTER_SCHEMA_VERSION,
    encounter_id: encounterId(persona_id, artifact.slug, started_at),
    persona_id,
    ...(run_id ? { run_id } : {}),
    artifact: {
      slug: artifact.slug || "",
      label: artifact.label || "",
      ...(artifact.url ? { url: artifact.url } : {}),
      ...(artifact.version ? { version: artifact.version } : {}),
      frozen: artifact.frozen === true,
    },
    started_at,
    blind,
    ...(blind ? {} : { prior_encounters_shown: prior }),
    conditions: {
      viewports,
      ...(driver ? { driver } : {}),
      ...(time_budget ? { time_budget } : {}),
    },
    verbatim: "<your reaction in your own words, unedited and never summarised>",
    findings: [
      {
        kind: "defect",
        claim: "",
        quote: "",
        locus: "",
        viewport: viewports[0],
        severity: "major",
        verified: "unverified",
      },
    ],
    decisions: [],
    unanswered: [],
    outcome: { understood_purpose: null, verdict: "partly" },
  };
  return e;
}
