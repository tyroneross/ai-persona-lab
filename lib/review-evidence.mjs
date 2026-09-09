/** Append-only review decisions and dispatch provenance. Raw encounters stay untouched. */
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { safeStorePath as safePath } from './store-path.mjs';
import { encounterMembershipProblem } from './run-membership.mjs';
import { assertIdSegment } from './idpath.mjs';

const DISPOSITIONS = ['source-confirmed', 'refuted', 'reclassified', 'editorial-accepted', 'deferred'];
const FACTUAL = ['source-confirmed', 'refuted', 'reclassified'];
const USAGE = ['input_tokens', 'output_tokens', 'total_tokens', 'cached_input_tokens', 'cost_usd', 'latency_ms'];
function requireText(field, value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
}
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
}
function read(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function runFor(input) {
  assertIdSegment('run_id', input.run_id);
  requireText('artifact_version', input.artifact_version);
  const file = safePath('runs', input.run_id, 'run.json');
  if (!existsSync(file)) throw new Error(`run not found: ${input.run_id}`);
  const run = read(file);
  if (run.run_id !== input.run_id) throw new Error('run_id does not match stored run');
  if (run.artifact?.version !== input.artifact_version) throw new Error('artifact_version does not match run');
  return run;
}
function encounterFor(id) {
  assertIdSegment('encounter_id', id);
  const root = safePath('encounters');
  const matches = [];
  if (existsSync(root)) for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = safePath('encounters', dir.name);
    for (const file of readdirSync(folder, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      const record = read(safePath('encounters', dir.name, file.name));
      if (record.encounter_id === id) {
        if (record.persona_id !== dir.name) throw new Error('encounter persona_id does not match folder');
        matches.push(record);
      }
    }
  }
  if (matches.length !== 1) throw new Error(`encounter_id must resolve exactly once: ${id}`);
  return matches[0];
}
function member(run, encounter) {
  const problem=encounterMembershipProblem(run,encounter);
  if (problem) throw new Error(problem);
  const attached = run.lanes?.some(l => l.encounter_ids?.includes(encounter.encounter_id));
  if (run.status !== 'open' && !attached) throw new Error('encounter was not attached before run closed');
  if (encounter.run_id !== run.run_id && !attached) throw new Error('encounter is not linked to run');
}
function records(folder, runId) {
  assertIdSegment('run_id', runId);
  const dir = safePath(folder, runId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile() && f.name.endsWith('.json'))
    .map(f => read(safePath(folder, runId, f.name)))
    .filter(r => r.run_id === runId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || (a.adjudication_id || a.receipt_id).localeCompare(b.adjudication_id || b.receipt_id));
}
function append(folder, idField, input, record) {
  const id = input[idField] ?? `${idField.replace('_id', '')}_${randomUUID()}`;
  assertIdSegment(idField, id);
  const previous = records(folder, record.run_id);
  if (input.correction_of !== undefined) {
    assertIdSegment('correction_of', input.correction_of);
    const prior = previous.find(r => r[idField] === input.correction_of);
    if (!prior) throw new Error('correction_of must name an existing record in this run');
    if (prior.persona_id !== record.persona_id || (idField === 'adjudication_id' && (prior.encounter_id !== record.encounter_id || prior.finding_id !== record.finding_id))) throw new Error('correction_of must concern the same subject');
    record.correction_of = input.correction_of;
  }
  const saved = { schema_version: '1.0.0', ...record, [idField]: id, created_at: new Date().toISOString() };
  const file = safePath(folder, record.run_id, `${id}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`, { flag: 'wx' });
  return { path: file, record: saved };
}
export function listAdjudications(runId) { return records('adjudications', runId); }
export function listDispatchReceipts(runId) { return records('dispatch-receipts', runId); }

export function saveAdjudication(input) {
  object(input, 'adjudication');
  const run = runFor(input);
  const encounter = encounterFor(input.encounter_id);
  member(run, encounter);
  if (input.persona_id !== undefined && input.persona_id !== encounter.persona_id) throw new Error('persona_id does not match encounter');
  assertIdSegment('finding_id', input.finding_id);
  const findings = (encounter.findings || []).filter((f, i) => (f.finding_id || `finding-${i + 1}`) === input.finding_id);
  if (findings.length !== 1) throw new Error('finding_id must resolve exactly once within encounter');
  requireText('author', input.author);
  if (!DISPOSITIONS.includes(input.disposition)) throw new Error(`disposition must be one of ${DISPOSITIONS.join(', ')}`);
  if (!['defect', 'confusion'].includes(findings[0].kind) && FACTUAL.includes(input.disposition)) throw new Error('preferences, praise and requests permit only editorial-accepted or deferred');
  if (FACTUAL.includes(input.disposition)) {
    requireText('evidence_locator', input.evidence_locator);
    requireText('verification_note', input.verification_note);
  }
  const record = { run_id: input.run_id, encounter_id: input.encounter_id, finding_id: input.finding_id,
    persona_id: encounter.persona_id, artifact_version: input.artifact_version, author: input.author, disposition: input.disposition };
  for (const key of ['evidence_locator', 'verification_note']) if (input[key] !== undefined) { requireText(key, input[key]); record[key] = input[key]; }
  if (input.accepted_changes !== undefined) {
    if (!Array.isArray(input.accepted_changes)) throw new Error('accepted_changes must be an array');
    record.accepted_changes = input.accepted_changes.map(change => {
      object(change, 'accepted change');
      requireText('accepted change path', change.path);
      if (path.isAbsolute(change.path) || change.path.includes('\\') || change.path.split('/').some(part => !part || part === '.' || part === '..') || change.path.includes('\0')) throw new Error('accepted change path must be a relative contained path');
      for (const key of ['before_sha256', 'after_sha256']) if (typeof change[key] !== 'string' || !/^[a-f0-9]{64}$/i.test(change[key])) throw new Error(`${key} must be a SHA-256 hex digest`);
      return { path: change.path, before_sha256: change.before_sha256, after_sha256: change.after_sha256 };
    });
  }
  const saved = append('adjudications', 'adjudication_id', input, record);
  return { path: saved.path, adjudication: saved.record };
}
function timestamp(field, value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp or null`);
  return value;
}
export function saveDispatchReceipt(input) {
  object(input, 'dispatch receipt');
  const run = runFor(input);
  assertIdSegment('persona_id', input.persona_id);
  if (!run.roster?.includes(input.persona_id)) throw new Error('persona_id is not in run roster');
  if (input.encounter_id !== undefined) {
    const encounter = encounterFor(input.encounter_id);
    member(run, encounter);
    if (encounter.persona_id !== input.persona_id) throw new Error('encounter persona_id does not match receipt');
  }
  const activity = input.activity ?? 'review';
  if (!['review', 'source-verification', 'integration'].includes(activity)) throw new Error('activity must be review, source-verification or integration');
  requireText('child_id', input.child_id);
  requireText('context_mode', input.context_mode);
  for (const key of ['prompt_sha256', 'profile_sha256']) if (typeof input[key] !== 'string' || !/^[a-f0-9]{64}$/i.test(input[key])) throw new Error(`${key} must be a SHA-256 hex digest`);
  if (!Array.isArray(input.prior_encounters_shown)) throw new Error('prior_encounters_shown must be an array');
  if (new Set(input.prior_encounters_shown).size !== input.prior_encounters_shown.length) throw new Error('prior_encounters_shown contains duplicates');
  for (const id of input.prior_encounters_shown) encounterFor(id);
  if (!['host-receipt', 'orchestrator-declared'].includes(input.provenance)) throw new Error('provenance must be host-receipt or orchestrator-declared');
  if (input.provenance === 'host-receipt') requireText('evidence_locator', input.evidence_locator);
  const started_at = timestamp('started_at', input.started_at);
  const ended_at = timestamp('ended_at', input.ended_at);
  if (started_at && ended_at && Date.parse(ended_at) < Date.parse(started_at)) throw new Error('ended_at precedes started_at');
  if (input.model !== undefined && input.model !== null) requireText('model', input.model);
  if (input.usage !== undefined && input.usage !== null) object(input.usage, 'usage');
  const usage = {};
  for (const key of Object.keys(input.usage || {})) if (!USAGE.includes(key)) throw new Error(`unknown usage field: ${key}`);
  for (const key of USAGE) {
    const value = input.usage?.[key] ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(`usage.${key} must be finite nonnegative or null`);
    usage[key] = value;
  }
  if (input.packet_sha256 !== undefined && (typeof input.packet_sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.packet_sha256))) throw new Error('packet_sha256 must be a SHA-256 digest');
  if (usage.input_tokens !== null && usage.output_tokens !== null && usage.total_tokens !== null && usage.total_tokens !== usage.input_tokens + usage.output_tokens) throw new Error('total_tokens must equal input_tokens + output_tokens');
  if (usage.cached_input_tokens !== null && usage.input_tokens !== null && usage.cached_input_tokens > usage.input_tokens) throw new Error('cached_input_tokens exceeds input_tokens');
  if (input.encounter_id) {
    const encounter=encounterFor(input.encounter_id);
    if (JSON.stringify(encounter.prior_encounters_shown || []) !== JSON.stringify(input.prior_encounters_shown)) throw new Error('prior encounters do not match linked encounter');
  }
  if (input.packet_sha256) {
    const packetFile=safePath('runs',input.run_id,'packets',`${input.packet_sha256}.json`);
    if (!existsSync(packetFile)) throw new Error('packet_sha256 does not resolve to a saved packet in this run');
    const packet=read(packetFile);
    const {packet_sha256,...payload}=packet;
    const actual=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    if (actual!==input.packet_sha256 || packet_sha256!==input.packet_sha256) throw new Error('saved packet digest mismatch');
    if (packet.run_id!==input.run_id || packet.persona_id!==input.persona_id || packet.profile_sha256!==input.profile_sha256 || packet.artifact?.version!==input.artifact_version) throw new Error('receipt does not match saved packet identity');
  }
  const record = { run_id: input.run_id, persona_id: input.persona_id, artifact_version: input.artifact_version,
    child_id: input.child_id, context_mode: input.context_mode, prompt_sha256: input.prompt_sha256, profile_sha256: input.profile_sha256,
    prior_encounters_shown: [...input.prior_encounters_shown], started_at, ended_at, model: input.model ?? null,
    usage, provenance: input.provenance, activity, ...(input.packet_sha256 ? {packet_sha256:input.packet_sha256} : {}), ...(input.encounter_id === undefined ? {} : { encounter_id: input.encounter_id }) };
  if (input.evidence_locator !== undefined) { requireText('evidence_locator', input.evidence_locator); record.evidence_locator = input.evidence_locator; }
  const saved = append('dispatch-receipts', 'receipt_id', input, record);
  return { path: saved.path, receipt: saved.record };
}
