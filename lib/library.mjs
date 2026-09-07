/**
 * Global persona library — the shared store the CLI, coding agents, and the
 * Next.js app all read and write.
 *
 * Layout (default ~/.persona-lab, override with PERSONA_LAB_HOME):
 *   ~/.persona-lab/
 *     personas.json          { schema_version, personas[] }   (same shape the app uses)
 *     rosters/<slug>.json     named lens/persona presets for a use-case
 *
 * No third-party deps: file I/O + a minimal, load-bearing validator only.
 */

import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";

export const SCHEMA_VERSION = "1.1.0";
const SUPPORTED_SCHEMA_VERSIONS = ["1.0.0", "1.1.0"];
const PROVENANCE = ["proto", "qualitative", "synthetic-grounded", "synthetic-assumed"];
const STATUS = ["draft", "active", "archived"];
const LIFESPANS = ["persistent", "temporary"];
const RECALL_SCOPES = ["none", "artifact", "project", "all"];

/** Resolve the library home. PERSONA_LAB_HOME wins; else ~/.persona-lab. */
export function libraryHome() {
  return process.env.PERSONA_LAB_HOME
    ? path.resolve(process.env.PERSONA_LAB_HOME)
    : path.join(os.homedir(), ".persona-lab");
}

function personasPath() {
  return path.join(libraryHome(), "personas.json");
}

function rostersDir() {
  return path.join(libraryHome(), "rosters");
}

function ensureHome() {
  mkdirSync(rostersDir(), { recursive: true });
}

function atomicWrite(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, filePath);
}

// --- ids -------------------------------------------------------------------

function slugify(value, fallback = "persona") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || fallback;
}

function hex8() {
  return crypto.randomBytes(4).toString("hex");
}

export function personaId(name) {
  return `persona_${slugify(name)}_${hex8()}`;
}

export function evidenceId(label) {
  return `evidence_${slugify(label, "item")}_${hex8()}`;
}

export function rosterSlug(name) {
  return slugify(name, "roster");
}

// --- validation (minimal, load-bearing) ------------------------------------

const REQUIRED_STRING_LISTS = ["goals", "frustrations", "motivations", "behaviors", "needs"];

/**
 * Validate the constraints that actually matter for a usable persona.
 * Returns { ok, errors[] }. Not a full JSON-schema validator by design
 * (minimal deps) — the canonical schema is schemas/persona.schema.json.
 */
export function validatePersona(p) {
  const errors = [];
  const req = (cond, msg) => {
    if (!cond) errors.push(msg);
  };
  const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
  const nonEmptyList = (v) => Array.isArray(v) && v.length > 0 && v.every(nonEmpty);

  req(p && typeof p === "object", "persona must be an object");
  if (!p || typeof p !== "object") return { ok: false, errors };

  req(SUPPORTED_SCHEMA_VERSIONS.includes(p.schema_version), `schema_version must be one of ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`);
  req(typeof p.id === "string" && /^persona_[a-z0-9][a-z0-9-]*_[a-f0-9]{8}$/.test(p.id), "id must match persona_<slug>_<8hex>");
  req(STATUS.includes(p.status), `status must be one of ${STATUS.join(", ")}`);
  if (p.lifespan !== undefined) {
    req(LIFESPANS.includes(p.lifespan), `lifespan must be one of ${LIFESPANS.join(", ")}`);
  }
  if (p.recall !== undefined) {
    req(RECALL_SCOPES.includes(p.recall), `recall must be one of ${RECALL_SCOPES.join(", ")}`);
  }
  // A temporary persona is scoped to one run, so "everything it has ever seen"
  // is a contradiction: there is no history outside that run to recall.
  if (p.lifespan === "temporary" && (p.recall === "all" || p.recall === "project")) {
    errors.push(`a temporary persona cannot have recall "${p.recall}" — it has no history outside its run`);
  }
  req(nonEmpty(p.name), "name is required");
  req(nonEmpty(p.archetype), "archetype is required");
  req(nonEmpty(p.role), "role is required");
  req(nonEmpty(p.summary) && p.summary.length >= 40, "summary must be >= 40 chars");
  req(nonEmpty(p.primary_goal), "primary_goal is required");
  for (const key of REQUIRED_STRING_LISTS) {
    req(nonEmptyList(p[key]), `${key} must be a non-empty string list`);
  }
  req(Array.isArray(p.scenarios) && p.scenarios.length >= 1, "scenarios must have >= 1 item");
  // A required field satisfied by an empty stub is theater. The `persona new`
  // scaffold ships [{title:"",description:""}]; without this, every persona
  // created on the happy path saves with a scenario that says nothing.
  if (Array.isArray(p.scenarios)) {
    p.scenarios.forEach((sc, i) => {
      if (!sc || typeof sc !== "object" || Array.isArray(sc)) {
        return errors.push(`scenarios[${i}] must be an object`);
      }
      const title = sc.title ?? sc.name;
      const body = sc.description ?? sc.context;
      req(typeof title === "string" && title.trim().length > 0,
        `scenarios[${i}].title is required and cannot be blank`);
      req(typeof body === "string" && body.trim().length > 0,
        `scenarios[${i}].description is required and cannot be blank`);
    });
  }
  req(Array.isArray(p.evidence) && p.evidence.length >= 1, "evidence must have >= 1 item (use source_type 'synthetic' + provenance for ungrounded personas)");
  req(typeof p.confidence === "number" && p.confidence >= 0 && p.confidence <= 1, "confidence must be a number in [0,1]");
  req(nonEmpty(p.created_at), "created_at is required");
  req(nonEmpty(p.updated_at), "updated_at is required");

  // v1.1 optional-but-validated fields
  if (p.provenance !== undefined) {
    req(PROVENANCE.includes(p.provenance), `provenance must be one of ${PROVENANCE.join(", ")}`);
  }
  if (p.anti_goals !== undefined) {
    req(nonEmptyList(p.anti_goals), "anti_goals, if present, must be a non-empty string list");
  }
  if (p.job_to_be_done !== undefined) {
    req(nonEmpty(p.job_to_be_done), "job_to_be_done, if present, must be a non-empty string");
  }
  if (p.composition !== undefined) {
    const c = p.composition;
    if (!c || typeof c !== "object" || Array.isArray(c)) {
      errors.push("composition must be an object");
    } else {
      const slug = (v) => typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
      req(Object.keys(c).every((key) => ["version", "archetype_ids", "specialty_paths", "evidence_ids"].includes(key)), "composition contains an unknown field");
      req(c.version === "1", "composition.version must be 1");
      req(Array.isArray(c.archetype_ids) && c.archetype_ids.length > 0 && c.archetype_ids.every(slug), "composition.archetype_ids must be a non-empty slug array");
      req(Array.isArray(c.specialty_paths) && c.specialty_paths.every((parts) => Array.isArray(parts) && parts.length > 0 && parts.every(slug)), "composition.specialty_paths must contain non-empty slug paths");
      req(Array.isArray(c.evidence_ids) && c.evidence_ids.every((id) => typeof id === "string" && /^evidence_[a-z0-9][a-z0-9-]*_[a-f0-9]{8}$/.test(id)), "composition.evidence_ids must contain evidence IDs");
      if (Array.isArray(c.evidence_ids)) {
        const evidenceIds = new Set(Array.isArray(p.evidence) ? p.evidence.map((item) => item?.id) : []);
        req(c.evidence_ids.every((id) => evidenceIds.has(id)), "composition.evidence_ids must reference persona evidence");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidPersona(p) {
  const { ok, errors } = validatePersona(p);
  if (!ok) throw new Error(`Invalid persona:\n- ${errors.join("\n- ")}`);
}

// --- persona store ---------------------------------------------------------

function readStore() {
  const file = personasPath();
  if (!existsSync(file)) return { schema_version: SCHEMA_VERSION, personas: [] };
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return {
    schema_version: parsed.schema_version || SCHEMA_VERSION,
    personas: Array.isArray(parsed.personas) ? parsed.personas : [],
  };
}

function writeStore(store) {
  ensureHome();
  store.personas.forEach(assertValidPersona);
  atomicWrite(personasPath(), `${JSON.stringify(store, null, 2)}\n`);
}

export function listPersonas(filters = {}) {
  const { personas } = readStore();
  return personas
    .filter((p) => matchesFilters(p, filters))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

export function getPersona(id) {
  return readStore().personas.find((p) => p.id === id) || null;
}

/** Insert or replace a persona (by id). Fills id/timestamps/schema if missing. */
/**
 * The fields savePersona assigns for you. `persona validate` applies these
 * before validating so it reports only gaps a human must actually fill —
 * otherwise a fresh `persona new` scaffold validates with a dozen errors that
 * saving would have silently fixed.
 */
export function withSaveDefaults(input) {
  const now = new Date().toISOString();
  return {
    status: "draft",
    tags: [],
    lifespan: "persistent",
    recall: "none",
    ...input,
    schema_version: SCHEMA_VERSION,
    id: input.id || (input.name ? personaId(input.name) : "persona_unnamed_00000000"),
    created_at: input.created_at || now,
    updated_at: now,
  };
}

export function savePersona(input) {
  const store = readStore();
  const now = new Date().toISOString();
  const existingIndex = input.id ? store.personas.findIndex((p) => p.id === input.id) : -1;

  const persona = {
    status: "draft",
    tags: [],
    lifespan: "persistent",
    recall: "none",
    ...input,
    schema_version: SCHEMA_VERSION,
    id: input.id && existingIndex !== -1 ? input.id : input.id || personaId(input.name),
    created_at: existingIndex !== -1 ? store.personas[existingIndex].created_at : input.created_at || now,
    updated_at: now,
  };

  assertValidPersona(persona);
  if (existingIndex !== -1) store.personas[existingIndex] = persona;
  else store.personas.unshift(persona);
  writeStore(store);
  return persona;
}

export function removePersona(id) {
  const store = readStore();
  const before = store.personas.length;
  store.personas = store.personas.filter((p) => p.id !== id);
  if (store.personas.length === before) return false;
  writeStore(store);
  return true;
}

export function archivePersona(id) {
  const p = getPersona(id);
  if (!p) return null;
  return savePersona({ ...p, status: "archived" });
}

export function searchPersonas(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return listPersonas();
  const hay = (p) =>
    [
      p.name, p.role, p.archetype, p.summary, p.primary_goal, p.job_to_be_done, p.quote,
      ...(p.goals || []), ...(p.frustrations || []), ...(p.motivations || []),
      ...(p.behaviors || []), ...(p.needs || []), ...(p.anti_goals || []), ...(p.tags || []),
      ...(p.composition?.archetype_ids || []),
      ...(p.composition?.specialty_paths || []).map((parts) => parts.join("/")),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  return listPersonas().filter((p) => hay(p).includes(q));
}

function matchesFilters(p, filters) {
  if (filters.status && !filters.status.includes(p.status)) return false;
  if (filters.role && String(p.role).toLowerCase() !== String(filters.role).toLowerCase()) return false;
  if (filters.tag && !(p.tags || []).map((t) => t.toLowerCase()).includes(String(filters.tag).toLowerCase())) return false;
  return true;
}

// --- roster store ----------------------------------------------------------

export function listRosters() {
  const dir = rostersDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function getRoster(name) {
  const file = path.join(rostersDir(), `${rosterSlug(name)}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

export function saveRoster(roster) {
  ensureHome();
  const now = new Date().toISOString();
  const slug = rosterSlug(roster.name);
  const existing = getRoster(roster.name);
  const record = {
    name: roster.name,
    slug,
    use_case: roster.use_case || "",
    description: roster.description || "",
    lenses: Array.isArray(roster.lenses) ? roster.lenses : [],
    persona_ids: Array.isArray(roster.persona_ids) ? roster.persona_ids : [],
    measurement: Array.isArray(roster.measurement) && roster.measurement.length
      ? roster.measurement
      : ["Task completion", "Comprehension", "Friction", "Trust", "Risk", "Business fit"],
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };
  atomicWrite(path.join(rostersDir(), `${slug}.json`), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function removeRoster(name) {
  const file = path.join(rostersDir(), `${rosterSlug(name)}.json`);
  if (!existsSync(file)) return false;
  unlinkSync(file);
  return true;
}
