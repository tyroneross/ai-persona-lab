/**
 * recommendations — the packet that turns a panel into addressed work.
 *
 * `run close --synthesis` records what the panel concluded. It does not record
 * who is supposed to act on it, so every recommendation left the run as prose
 * addressed to nobody. This packet closes that gap with two required fields per
 * item: a named `consumer` and an `acceptance_check`. A recommendation with no
 * named consumer is a note, and notes do not get executed.
 *
 *   <libraryHome>/runs/<run_id>/recommendations/<packet_id>.json
 *
 * Append-only for the same reason encounters are. A second round writes a second
 * packet; the first is never edited, because "what we recommended before the
 * artifact changed" is the only evidence that a position moved. `latestPacket`
 * is computed by sorting, not stored in a pointer file — a pointer is mutable
 * state that can disagree with the directory it points into.
 *
 * A CLOSED run still accepts a packet. Recommendations are written after
 * adjudication and synthesis, which happen at close; requiring an open run would
 * force the packet to be written before the reasoning it summarises exists. An
 * ABANDONED run does not: a panel nobody finished should not be producing work
 * orders for other agents.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { safeStorePath } from './store-path.mjs';
import { assertIdSegment } from './idpath.mjs';
import { listLanes } from './orchestrator.mjs';

// Read run.json directly rather than importing readRun: runs.mjs renders this
// packet into report.md, and an import back would close a cycle. This mirrors
// how review-evidence.mjs resolves the run it is writing against.
function readRunRecord(runId) {
  const file = safeStorePath('runs', runId, 'run.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

export const RECOMMENDATION_PACKET_SCHEMA_VERSION = '1.0.0';
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const PROVENANCE = ['evidence-grounded', 'assumption'];
export const ADJUDICATIONS = ['source-confirmed', 'reclassified', 'refuted', 'deferred', 'editorial-accepted', 'unverified'];
export const CONSUMER_KINDS = ['agent', 'skill', 'human'];
export const STATUSES = ['proposed', 'accepted', 'executed', 'rejected'];
const REMINDER = 'hypothesis, not validation';

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateRecommendationPacket(packet) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { ok: false, errors: ['recommendation packet must be a JSON object'] };
  }
  req(packet.schema_version === RECOMMENDATION_PACKET_SCHEMA_VERSION, `schema_version must be ${RECOMMENDATION_PACKET_SCHEMA_VERSION}`);
  req(isStr(packet.run_id), 'run_id is required');
  req(isStr(packet.artifact), 'artifact is required');
  req(isStr(packet.artifact_version), 'artifact_version is required — a recommendation names the version it was derived from');
  const laneIds = listLanes().map((l) => l.id);
  req(laneIds.includes(packet.lane), `lane must be one of ${laneIds.join(', ')}`);
  req(packet.reminder === REMINDER, `reminder must be "${REMINDER}"`);

  if (!Array.isArray(packet.outcome_frame) || packet.outcome_frame.length === 0) {
    errors.push('outcome_frame must record the questions the orchestrator answered before selecting personas');
  } else {
    packet.outcome_frame.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return errors.push(`outcome_frame[${i}] must be an object`);
      req(isStr(entry.question), `outcome_frame[${i}].question is required`);
      // An unanswered frame question is the failure this packet exists to make
      // visible. Recording it as an assumption is allowed; omitting it is not.
      req(isStr(entry.answer), `outcome_frame[${i}].answer is required — write the assumption you proceeded on and set assumption: true`);
      if (entry.assumption !== undefined) req(typeof entry.assumption === 'boolean', `outcome_frame[${i}].assumption must be a boolean`);
    });
  }

  if (!Array.isArray(packet.recommendations) || packet.recommendations.length === 0) {
    errors.push('recommendations must contain at least one item');
  } else {
    const seen = new Set();
    packet.recommendations.forEach((r, i) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return errors.push(`recommendations[${i}] must be an object`);
      req(isStr(r.id), `recommendations[${i}].id is required`);
      if (isStr(r.id)) {
        req(!seen.has(r.id), `recommendations[${i}].id repeats "${r.id}"`);
        seen.add(r.id);
      }
      req(isStr(r.title), `recommendations[${i}].title is required`);
      req(isStr(r.recommendation), `recommendations[${i}].recommendation is required`);
      req(Array.isArray(r.finding_ids) && r.finding_ids.every(isStr), `recommendations[${i}].finding_ids must be an array of strings`);
      req(SEVERITIES.includes(r.severity), `recommendations[${i}].severity must be one of ${SEVERITIES.join(', ')}`);
      req(PROVENANCE.includes(r.provenance), `recommendations[${i}].provenance must be one of ${PROVENANCE.join(', ')}`);
      req(ADJUDICATIONS.includes(r.adjudication), `recommendations[${i}].adjudication must be one of ${ADJUDICATIONS.join(', ')}`);
      req(STATUSES.includes(r.status), `recommendations[${i}].status must be one of ${STATUSES.join(', ')}`);
      req(isStr(r.acceptance_check), `recommendations[${i}].acceptance_check is required — name how the consumer proves it landed`);
      if (!r.consumer || typeof r.consumer !== 'object' || Array.isArray(r.consumer)) {
        errors.push(`recommendations[${i}].consumer is required — name the agent, skill or person who executes this`);
      } else {
        req(CONSUMER_KINDS.includes(r.consumer.kind), `recommendations[${i}].consumer.kind must be one of ${CONSUMER_KINDS.join(', ')}`);
        req(isStr(r.consumer.name), `recommendations[${i}].consumer.name is required`);
      }
      // Two integrity rules the enum alone cannot hold:
      // a defect the adjudicator disproved is not work, and an ungrounded
      // assumption cannot claim the label reserved for a checked source.
      if (r.adjudication === 'refuted' && ['accepted', 'executed'].includes(r.status)) {
        errors.push(`recommendations[${i}] was refuted during adjudication and cannot be ${r.status}`);
      }
      if (r.provenance === 'assumption' && r.adjudication === 'source-confirmed') {
        errors.push(`recommendations[${i}] cannot be source-confirmed while its provenance is assumption`);
      }
    });
  }

  if (packet.open_questions !== undefined) {
    req(Array.isArray(packet.open_questions) && packet.open_questions.every(isStr), 'open_questions must be an array of strings');
  }
  if (!packet.iteration || typeof packet.iteration !== 'object' || Array.isArray(packet.iteration)) {
    errors.push('iteration is required (object with round)');
  } else {
    req(Number.isInteger(packet.iteration.round) && packet.iteration.round >= 1, 'iteration.round must be an integer >= 1');
    if (packet.iteration.prior_run_ids !== undefined) {
      req(Array.isArray(packet.iteration.prior_run_ids) && packet.iteration.prior_run_ids.every(isStr), 'iteration.prior_run_ids must be an array of run ids');
    }
    if (packet.iteration.trigger !== undefined) req(isStr(packet.iteration.trigger), 'iteration.trigger must be a non-empty string');
  }
  return { ok: errors.length === 0, errors };
}

export function recommendationsDir(runId) {
  return safeStorePath('runs', runId, 'recommendations');
}

export function listRecommendationPackets(runId) {
  assertIdSegment('run_id', runId);
  const dir = recommendationsDir(runId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f.name), 'utf8')))
    .filter((p) => p.run_id === runId)
    .sort((a, b) => (a.iteration?.round ?? 0) - (b.iteration?.round ?? 0)
      || String(a.created_at).localeCompare(String(b.created_at))
      || String(a.packet_id).localeCompare(String(b.packet_id)));
}

/** The newest packet by round then creation time, or null. Computed, never stored. */
export function latestRecommendationPacket(runId) {
  const all = listRecommendationPackets(runId);
  return all.length ? all[all.length - 1] : null;
}

export function saveRecommendationPacket(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('recommendation packet must be a JSON object');
  assertIdSegment('run_id', input.run_id);
  const run = readRunRecord(input.run_id);
  if (!run) throw new Error(`run not found: ${input.run_id}`);
  if (run.status === 'abandoned') throw new Error(`run ${input.run_id} was abandoned — an unfinished panel does not issue work orders`);

  const packet = {
    schema_version: RECOMMENDATION_PACKET_SCHEMA_VERSION,
    ...input,
    packet_id: input.packet_id || `packet_${randomUUID()}`,
    run_id: run.run_id,
    artifact: input.artifact || run.artifact?.slug,
    artifact_version: input.artifact_version || run.artifact?.version,
    reminder: REMINDER,
    created_at: new Date().toISOString(),
  };
  assertIdSegment('packet_id', packet.packet_id);
  // The packet must name the version the panel actually judged. A packet stamped
  // with a newer version silently claims findings about an artifact no persona saw.
  if (packet.artifact !== run.artifact?.slug) throw new Error('artifact does not match the run');
  if (packet.artifact_version !== run.artifact?.version) throw new Error('artifact_version does not match the run');
  const { ok, errors } = validateRecommendationPacket(packet);
  if (!ok) throw new Error(`Invalid recommendation packet:\n- ${errors.join('\n- ')}`);

  const file = safeStorePath('runs', run.run_id, 'recommendations', `${packet.packet_id}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, { flag: 'wx' });
  return { path: file, packet };
}

/** The packet's markdown section for report.md. Kept here so the report stays a rendering of records. */
export function renderRecommendationPacket(packet) {
  if (!packet) return [];
  const L = [];
  L.push('## Recommendations — who executes what');
  L.push('');
  L.push(`Packet \`${packet.packet_id}\` · lane ${packet.lane} · round ${packet.iteration?.round ?? 1} · artifact ${packet.artifact} @ \`${packet.artifact_version}\``);
  L.push('');
  L.push('Outcome frame the orchestrator answered before selecting personas:');
  L.push('');
  for (const entry of packet.outcome_frame || []) {
    L.push(`- **${entry.question}** ${entry.answer}${entry.assumption ? ' _(assumption)_' : ''}`);
  }
  L.push('');
  L.push('| Recommendation | Severity | Consumer | Provenance / adjudication | Status | Acceptance check |');
  L.push('|---|---|---|---|---|---|');
  for (const r of packet.recommendations || []) {
    L.push(`| ${r.title} | ${r.severity} | ${r.consumer?.kind}:${r.consumer?.name} | ${r.provenance} / ${r.adjudication} | ${r.status} | ${r.acceptance_check} |`);
  }
  L.push('');
  for (const r of packet.recommendations || []) {
    L.push(`- \`${r.id}\` — ${r.recommendation}${r.finding_ids?.length ? ` (from ${r.finding_ids.join(', ')})` : ' (orchestrator-originated; no persona finding behind it)'}`);
  }
  L.push('');
  if (packet.open_questions?.length) {
    L.push('Open questions carried out of this round:');
    L.push('');
    for (const q of packet.open_questions) L.push(`- ${q}`);
    L.push('');
  }
  if (packet.iteration?.prior_run_ids?.length) {
    L.push(`Prior rounds: ${packet.iteration.prior_run_ids.join(', ')}${packet.iteration.trigger ? ` — re-run triggered by: ${packet.iteration.trigger}` : ''}`);
    L.push('');
  }
  return L;
}
