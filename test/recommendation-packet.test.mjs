/**
 * The recommendation packet contract.
 *
 * The packet exists so a panel's output is addressed to somebody. Two fields
 * carry that and nothing else enforces them: `consumer` and `acceptance_check`.
 * The rest of this file guards the integrity rules an enum cannot hold — a
 * refuted finding is not work, an assumption cannot be source-confirmed, and a
 * packet cannot claim a version the panel never saw.
 *
 * The schema and the writer are round-tripped against each other, the same way
 * encounter-schema.test.mjs guards the encounter writer, so a schema edit that
 * the writer does not follow fails loudly instead of passing quietly.
 *
 * All tests use a temp PERSONA_LAB_HOME — never the user's real library.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from './helpers/jsonschema.mjs';
import { composePersona } from '../lib/archetypes.mjs';
import { savePersona } from '../lib/library.mjs';
import { createRun, closeRun, readRun, writeReport, runDir } from '../lib/runs.mjs';
import {
  RECOMMENDATION_PACKET_SCHEMA_VERSION, saveRecommendationPacket, listRecommendationPackets,
  latestRecommendationPacket, validateRecommendationPacket,
} from '../lib/recommendations.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'bin/persona.mjs');
const schema = JSON.parse(readFileSync(new URL('../schemas/recommendation-packet.schema.json', import.meta.url), 'utf8'));

function freshHome() {
  const dir = mkdtempSync(path.join(tmpdir(), 'persona-recommend-'));
  process.env.PERSONA_LAB_HOME = dir;
  return dir;
}

function openRun({ version = 'v1' } = {}) {
  const persona = savePersona(composePersona({ archetypes: ['designer'] }).persona);
  return createRun({ request: 'Does the checkout work for a first-time buyer?',
    artifact: { slug: 'checkout', label: 'Checkout', version }, roster: [persona.id] });
}

function validPacket(overrides = {}) {
  return {
    lane: 'ui-ux-design',
    outcome_frame: [{ question: 'Who is the end customer?', answer: 'A first-time buyer on mobile.', assumption: true }],
    recommendations: [{
      id: 'rec-1', title: 'Show shipping cost before the card field', finding_ids: ['enc_a/finding-1'],
      severity: 'high', provenance: 'evidence-grounded', adjudication: 'source-confirmed',
      recommendation: 'Move the shipping total above the payment section.',
      consumer: { kind: 'agent', name: 'build-loop:implementer' },
      acceptance_check: 'Shipping total renders above the card field at 390px width.',
      status: 'proposed',
    }],
    open_questions: ['Does the buyer see the total before authentication?'],
    iteration: { round: 1 },
    ...overrides,
  };
}

test('a saved packet validates against the published schema', () => {
  freshHome();
  const run = openRun();
  const { packet } = saveRecommendationPacket({ ...validPacket(), run_id: run.run_id });
  assert.equal(packet.schema_version, RECOMMENDATION_PACKET_SCHEMA_VERSION);
  assert.deepEqual(validate(schema, packet), { ok: true, errors: [] });
});

test('a recommendation without a named consumer is rejected — a note is not a work order', () => {
  const packet = validPacket();
  delete packet.recommendations[0].consumer;
  const result = validateRecommendationPacket({ ...packet, schema_version: RECOMMENDATION_PACKET_SCHEMA_VERSION,
    run_id: 'run_x', artifact: 'checkout', artifact_version: 'v1', reminder: 'hypothesis, not validation' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /consumer is required/.test(e)));
});

test('bad enums and missing acceptance checks are rejected field by field', () => {
  const base = {
    schema_version: RECOMMENDATION_PACKET_SCHEMA_VERSION, run_id: 'run_x',
    artifact: 'checkout', artifact_version: 'v1', reminder: 'hypothesis, not validation',
  };
  const cases = [
    [{ status: 'done' }, /status must be one of/],
    [{ severity: 'blocker' }, /severity must be one of/],
    [{ provenance: 'guessed' }, /provenance must be one of/],
    [{ adjudication: 'confirmed' }, /adjudication must be one of/],
    [{ consumer: { kind: 'robot', name: 'x' } }, /consumer.kind must be one of/],
    [{ acceptance_check: '' }, /acceptance_check is required/],
  ];
  for (const [mutation, pattern] of cases) {
    const packet = validPacket();
    Object.assign(packet.recommendations[0], mutation);
    const result = validateRecommendationPacket({ ...base, ...packet });
    assert.equal(result.ok, false, JSON.stringify(mutation));
    assert.ok(result.errors.some((e) => pattern.test(e)), `${JSON.stringify(mutation)} -> ${result.errors.join('; ')}`);
  }
  const unknownLane = validateRecommendationPacket({ ...base, ...validPacket({ lane: 'design' }) });
  assert.equal(unknownLane.ok, false);
  assert.ok(unknownLane.errors.some((e) => /lane must be one of/.test(e)));
});

test('a refuted finding cannot become accepted work, and an assumption cannot be source-confirmed', () => {
  const base = {
    schema_version: RECOMMENDATION_PACKET_SCHEMA_VERSION, run_id: 'run_x',
    artifact: 'checkout', artifact_version: 'v1', reminder: 'hypothesis, not validation',
  };
  const refuted = validPacket();
  Object.assign(refuted.recommendations[0], { adjudication: 'refuted', status: 'accepted' });
  const a = validateRecommendationPacket({ ...base, ...refuted });
  assert.equal(a.ok, false);
  assert.ok(a.errors.some((e) => /refuted during adjudication and cannot be accepted/.test(e)));

  const promoted = validPacket();
  Object.assign(promoted.recommendations[0], { provenance: 'assumption', adjudication: 'source-confirmed' });
  const b = validateRecommendationPacket({ ...base, ...promoted });
  assert.equal(b.ok, false);
  assert.ok(b.errors.some((e) => /cannot be source-confirmed while its provenance is assumption/.test(e)));

  // The same pair stays legal when it is honest: refuted findings may be recorded as rejected.
  const honest = validPacket();
  Object.assign(honest.recommendations[0], { adjudication: 'refuted', status: 'rejected' });
  assert.equal(validateRecommendationPacket({ ...base, ...honest }).ok, true);
});

test('an unanswered outcome-frame question fails rather than silently disappearing', () => {
  const packet = validPacket({ outcome_frame: [{ question: 'Who is the end customer?' }] });
  const result = validateRecommendationPacket({
    schema_version: RECOMMENDATION_PACKET_SCHEMA_VERSION, run_id: 'run_x',
    artifact: 'checkout', artifact_version: 'v1', reminder: 'hypothesis, not validation', ...packet,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /answer is required/.test(e)));
});

test('a packet cannot claim a version or artifact the panel never judged', () => {
  freshHome();
  const run = openRun({ version: 'v1' });
  assert.throws(() => saveRecommendationPacket({ ...validPacket(), run_id: run.run_id, artifact_version: 'v2' }),
    /artifact_version does not match the run/);
  assert.throws(() => saveRecommendationPacket({ ...validPacket(), run_id: run.run_id, artifact: 'cart' }),
    /artifact does not match the run/);
  assert.throws(() => saveRecommendationPacket({ ...validPacket(), run_id: 'run_missing_2026-01-01_aaaaaa' }),
    /run not found/);
});

test('packets are append-only: a closed run still accepts one, an abandoned run does not', () => {
  freshHome();
  const closed = openRun();
  closeRun(closed.run_id, { synthesis: 'The buyer cannot see shipping cost before paying.' });
  const first = saveRecommendationPacket({ ...validPacket(), run_id: closed.run_id });
  const second = saveRecommendationPacket({ ...validPacket({ iteration: { round: 2, prior_run_ids: [closed.run_id], trigger: 'artifact changed' } }), run_id: closed.run_id });
  assert.notEqual(first.packet.packet_id, second.packet.packet_id, 'a second round never overwrites the first');
  assert.equal(listRecommendationPackets(closed.run_id).length, 2);
  assert.equal(latestRecommendationPacket(closed.run_id).iteration.round, 2, 'latest is computed, not stored');
  assert.equal(readFileSync(first.path, 'utf8').includes('"round": 1'), true, 'round 1 stays exactly as written');

  const abandoned = openRun();
  closeRun(abandoned.run_id, { status: 'abandoned' });
  assert.throws(() => saveRecommendationPacket({ ...validPacket(), run_id: abandoned.run_id }),
    /was abandoned/);
});

test('run report shows the latest packet and names every consumer', () => {
  freshHome();
  const run = openRun();
  saveRecommendationPacket({ ...validPacket(), run_id: run.run_id });
  saveRecommendationPacket({
    ...validPacket({
      iteration: { round: 2, prior_run_ids: [run.run_id], trigger: 'the interface changed' },
      recommendations: [{
        id: 'rec-2', title: 'Confirm the total survives a reload', finding_ids: [],
        severity: 'medium', provenance: 'assumption', adjudication: 'unverified',
        recommendation: 'Re-check the cart total after a page reload.',
        consumer: { kind: 'human', name: 'design owner' },
        acceptance_check: 'Total matches before and after reload at 390px.',
        status: 'proposed',
      }],
    }),
    run_id: run.run_id,
  });
  const report = readFileSync(writeReport(readRun(run.run_id)), 'utf8');
  assert.match(report, /## Recommendations — who executes what/);
  assert.match(report, /human:design owner/);
  assert.match(report, /round 2/);
  assert.match(report, /2 packets recorded/);
  assert.match(report, /orchestrator-originated; no persona finding behind it/);
});

test('CLI run recommend validates, writes, and lists', () => {
  const home = freshHome();
  const run = openRun();
  const env = { ...process.env, PERSONA_LAB_HOME: home };
  const file = path.join(home, 'packet.json');

  writeFileSync(file, JSON.stringify({ ...validPacket(), run_id: run.run_id }));
  const saved = JSON.parse(execFileSync('node', [cli, 'run', 'recommend', run.run_id, file, '--json'], { env, encoding: 'utf8' }));
  assert.equal(saved.packet.recommendations.length, 1);
  assert.ok(saved.path.startsWith(path.join(runDir(run.run_id), 'recommendations')));

  const listed = JSON.parse(execFileSync('node', [cli, 'run', 'recommendations', run.run_id, '--json'], { env, encoding: 'utf8' }));
  assert.equal(listed.count, 1);
  assert.equal(listed.latest.packet_id, saved.packet_id);

  const bad = path.join(home, 'bad.json');
  const invalid = validPacket();
  delete invalid.recommendations[0].consumer;
  writeFileSync(bad, JSON.stringify({ ...invalid, run_id: run.run_id, artifact: 'checkout', artifact_version: 'v1' }));
  assert.throws(() => execFileSync('node', [cli, 'run', 'recommend', run.run_id, bad], { env, encoding: 'utf8', stdio: 'pipe' }),
    /consumer is required/);
});

test.after(() => {
  const home = process.env.PERSONA_LAB_HOME;
  if (home && home.includes('persona-recommend-')) rmSync(home, { recursive: true, force: true });
});
