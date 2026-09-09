import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { saveAdjudication, listAdjudications, saveDispatchReceipt, listDispatchReceipts } from '../lib/review-evidence.mjs';

function fixture(t) {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-evidence-'));
  process.env.PERSONA_LAB_HOME = home;
  t.after(() => { if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous; rmSync(home, { recursive: true, force: true }); });
  const run = { status:'open', run_id: 'run-one', artifact: { slug: 'app', version: 'v1' }, roster: ['persona-one', 'persona-two'], lanes: [] };
  const encounter = { encounter_id: 'enc-one', run_id: run.run_id, persona_id: 'persona-one', artifact: run.artifact, findings: [{ kind: 'defect', claim: 'Absent field' }, { kind: 'preference', claim: 'Prefer blue' }] };
  const runPath = path.join(home, 'runs', run.run_id, 'run.json');
  const encounterPath = path.join(home, 'encounters', encounter.persona_id, 'enc.json');
  const put = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)); };
  put(runPath, run); put(encounterPath, encounter);
  const adjudication = { run_id: run.run_id, encounter_id: encounter.encounter_id, finding_id: 'finding-1', artifact_version: 'v1', author: 'reviewer', disposition: 'source-confirmed', evidence_locator: 'src/app.mjs:8', verification_note: 'Source field is absent.' };
  const receipt = { run_id: run.run_id, persona_id: encounter.persona_id, artifact_version: 'v1', child_id: 'child-one', context_mode: 'none', prompt_sha256: 'a'.repeat(64), profile_sha256: 'b'.repeat(64), prior_encounters_shown: [], provenance: 'orchestrator-declared' };
  return { home, run, encounter, runPath, encounterPath, put, adjudication, receipt };
}
test('adjudication appends corrections and preserves exact raw run and encounter bytes', t => {
  const f = fixture(t); const raw = readFileSync(f.encounterPath); const runRaw = readFileSync(f.runPath);
  const first = saveAdjudication({ ...f.adjudication, adjudication_id: 'decision-one' });
  const second = saveAdjudication({ ...f.adjudication, disposition: 'refuted', correction_of: first.adjudication.adjudication_id });
  assert.equal(second.adjudication.correction_of, 'decision-one');
  assert.equal(listAdjudications(f.run.run_id).length, 2);
  assert.deepEqual(readFileSync(f.encounterPath), raw); assert.deepEqual(readFileSync(f.runPath), runRaw);
  assert.throws(() => saveAdjudication({ ...f.adjudication, adjudication_id: 'decision-one' }), /EEXIST/);
  assert.throws(() => saveAdjudication({ ...f.adjudication, correction_of: 'absent' }), /correction_of/);
});
test('factual adjudication requires evidence and does not turn positions into defects', t => {
  const f = fixture(t);
  for (const key of ['evidence_locator', 'verification_note', 'author']) assert.throws(() => saveAdjudication({ ...f.adjudication, [key]: '' }), new RegExp(key));
  for (const disposition of ['source-confirmed', 'refuted', 'reclassified']) assert.throws(() => saveAdjudication({ ...f.adjudication, finding_id: 'finding-2', disposition }), /only editorial/);
  assert.equal(saveAdjudication({ ...f.adjudication, finding_id: 'finding-2', disposition: 'editorial-accepted' }).adjudication.disposition, 'editorial-accepted');
  assert.throws(() => saveAdjudication({ ...f.adjudication, finding_id: 'finding-99' }), /finding_id/);
});
test('IDs and run, artifact, persona and encounter relationships are checked', t => {
  const f = fixture(t);
  for (const value of ['../bad', '/tmp/escape', 'a\\b', '.', '', 'a\0b']) {
    for (const key of ['run_id', 'encounter_id', 'finding_id', 'adjudication_id']) assert.throws(() => saveAdjudication({ ...f.adjudication, [key]: value }));
    assert.throws(() => listAdjudications(value)); assert.throws(() => listDispatchReceipts(value));
  }
  assert.throws(() => saveAdjudication({ ...f.adjudication, artifact_version: 'v2' }), /artifact_version/);
  assert.throws(() => saveAdjudication({ ...f.adjudication, persona_id: 'persona-two' }), /persona|roster/);
  for (const patch of [{ run_id: 'other' }, { persona_id: 'not-rostered' }, { artifact: { slug: 'wrong', version: 'v1' } }, { artifact: { slug: 'app', version: 'v2' } }]) {
    f.put(f.encounterPath, { ...f.encounter, ...patch }); assert.throws(() => saveAdjudication(f.adjudication));
  }
});
test('receipt preserves unknown telemetry, records lineage and appends exclusively', t => {
  const f = fixture(t);
  const first = saveDispatchReceipt({ ...f.receipt, receipt_id: 'receipt-one', encounter_id: 'enc-one', activity: 'source-verification' });
  assert.equal(first.receipt.started_at, null); assert.equal(first.receipt.ended_at, null); assert.equal(first.receipt.model, null);
  assert.ok(Object.values(first.receipt.usage).every(v => v === null)); assert.equal(first.receipt.encounter_id, 'enc-one');
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, receipt_id: 'receipt-one' }), /EEXIST/);
  saveDispatchReceipt({ ...f.receipt, correction_of: 'receipt-one', usage: { input_tokens: 0, output_tokens: 20 } });
  assert.equal(listDispatchReceipts(f.run.run_id).length, 2);
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, encounter_id: 'enc-one', persona_id: 'persona-two' }), /persona|roster/);
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, artifact_version: 'v2' }), /artifact_version/);
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, persona_id: 'unknown' }), /roster/);
});
test('receipt rejects fabricated host claims, invalid telemetry and lineage', t => {
  const f = fixture(t);
  for (const value of [-1, Infinity, NaN, '1', {}]) assert.throws(() => saveDispatchReceipt({ ...f.receipt, usage: { input_tokens: value } }), /finite nonnegative/);
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, usage: { savings: 12 } }), /unknown usage/);
  assert.throws(() => saveDispatchReceipt({ ...f.receipt, provenance: 'host-receipt' }), /evidence_locator/);
  assert.equal(saveDispatchReceipt({ ...f.receipt, provenance: 'host-receipt', evidence_locator: 'host/receipt.json' }).receipt.provenance, 'host-receipt');
  for (const patch of [{ prompt_sha256: 'bad' }, { profile_sha256: '' }, { prior_encounters_shown: ['absent'] }, { prior_encounters_shown: ['enc-one', 'enc-one'] }, { activity: 'unknown' }, { started_at: 'bad' }, { started_at: '2026-09-09T12:00:00Z', ended_at: '2026-09-09T11:00:00Z' }, { receipt_id: '../escape' }]) assert.throws(() => saveDispatchReceipt({ ...f.receipt, ...patch }));
});
test('accepted edit lineage validates paths and digests', t => {
  const f = fixture(t); const change = { path: 'src/app.mjs', before_sha256: 'a'.repeat(64), after_sha256: 'b'.repeat(64) };
  assert.deepEqual(saveAdjudication({ ...f.adjudication, accepted_changes: [change] }).adjudication.accepted_changes, [change]);
  for (const changedPath of ['/tmp/x', '../x', 'src/../x', 'src\\x', 'src//x']) assert.throws(() => saveAdjudication({ ...f.adjudication, accepted_changes: [{ ...change, path: changedPath }] }), /relative contained/);
  assert.throws(() => saveAdjudication({ ...f.adjudication, accepted_changes: [{ ...change, after_sha256: 'bad' }] }), /SHA-256/);
});
test('symlinked evidence folders and run files cannot escape the library', t => {
  const f = fixture(t); const outside = mkdtempSync(path.join(os.tmpdir(), 'persona-outside-')); t.after(() => rmSync(outside, { recursive: true, force: true }));
  symlinkSync(outside, path.join(f.home, 'adjudications'));
  assert.throws(() => saveAdjudication(f.adjudication), /symlink/);
  rmSync(f.runPath); symlinkSync(path.join(outside, 'missing.json'), f.runPath);
  assert.throws(() => saveDispatchReceipt(f.receipt), /symlink/);
});
