import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluatePanel } from '../lib/panel-evaluation.mjs';

const cli = fileURLToPath(new URL('../bin/persona.mjs', import.meta.url));
const input = () => ({
  schema_version: '1', artifact: 'persona-brief-decision@02ac76b',
  question: 'Can a user select appropriate decision reviewers and see what each contributed?',
  reference: { kind: 'human-observation', issues: [
    { id: 'choice', summary: 'Reviewer choice is unclear' },
    { id: 'trace', summary: 'The source of each recommendation is unclear' },
  ] },
  review_status: { baseline: 'complete', panel: 'complete' },
  personas: ['novice', 'operator'],
  findings: [
    { id: 'b1', method: 'baseline', summary: 'Choice is unclear', status: 'supported', evidence: 'Observed at step 2', reference_issue_ids: ['choice'] },
    { id: 'p1', method: 'panel', persona_id: 'novice', summary: 'I cannot choose a reviewer', status: 'supported', evidence: 'Observed at step 2', reference_issue_ids: ['choice'] },
    { id: 'p2', method: 'panel', persona_id: 'operator', summary: 'I need source traceability', status: 'supported', evidence: 'Observed at step 4', reference_issue_ids: ['trace'] },
    { id: 'p3', method: 'panel', persona_id: 'operator', summary: 'Maybe add another role', status: 'unresolved' },
  ],
  usage: { baseline: { cost_usd: 0.01, total_tokens: 100 }, panel: { cost_usd: 0.04, total_tokens: 400 } },
});

test('reports incremental observed coverage and preserves differing persona findings', () => {
  const result = evaluatePanel(input());
  assert.equal(result.calibration, 'human-observed');
  assert.equal(result.baseline.coverage, 0.5);
  assert.equal(result.panel.coverage, 1);
  assert.deepEqual(result.incremental_issue_ids, ['trace']);
  assert.deepEqual(result.personas.map(p => p.matched_issue_ids), [['choice'], ['trace']]);
  assert.equal(result.personas[1].finding_counts.unresolved, 1);
  assert.deepEqual(result.personas[1].findings.map(f => f.summary), ['I need source traceability', 'Maybe add another role']);
  assert.equal(result.panel_extra_cost_usd, 0.03);
  assert.equal(result.personas.every(p => !Object.hasOwn(p, 'score')), true);
});

test('with no real observations, calibration and coverage remain unavailable', () => {
  const assessment = input();
  assessment.reference = { kind: 'none', issues: [] };
  assessment.findings = [{ id: 'p1', method: 'panel', persona_id: 'novice', summary: 'A suggestion', status: 'unresolved' }];
  assessment.review_status = { baseline: 'pending', panel: 'complete' };
  delete assessment.usage;
  const result = evaluatePanel(assessment);
  assert.equal(result.calibration, 'unavailable');
  assert.equal(result.baseline.coverage, null);
  assert.equal(result.panel.coverage, null);
  assert.equal(result.panel_extra_cost_usd, null);
  assert.equal(result.incremental_issue_ids, null);
  assert.equal(result.missed_issue_ids, null);
});

test('does not report a calibration result before both reviews finish', () => {
  const assessment = input();
  assessment.review_status.panel = 'pending';
  assessment.findings = assessment.findings.filter(f => f.method === 'baseline');
  const result = evaluatePanel(assessment);
  assert.equal(result.calibration, 'unavailable');
  assert.equal(result.baseline.coverage, 0.5);
  assert.equal(result.panel.coverage, null);
  assert.equal(result.incremental_issue_ids, null);
  assert.equal(result.panel_extra_cost_usd, null);
});

test('rejects unsupported mappings and malformed evidence', () => {
  const cases = [
    [a => { a.findings[0].status = 'unresolved'; }, /only when supported/],
    [a => { a.findings[0].reference_issue_ids = ['missing']; }, /unknown reference issue/],
    [a => { a.findings[0].evidence = ''; }, /evidence must be nonempty/],
    [a => { a.findings[1].persona_id = 'missing'; }, /listed persona/],
    [a => { a.findings[1].id = 'b1'; }, /duplicate IDs/],
    [a => { a.usage.panel.cost_usd = -1; }, /nonnegative/],
    [a => { a.reference.kind = 'none'; }, /cannot contain issues/],
    [a => { a.review_status.panel = 'done'; }, /pending or complete/],
    [a => { a.review_status.panel = 'pending'; }, /belongs to a pending review/],
  ];
  for (const [change, expected] of cases) {
    const assessment = input(); change(assessment);
    assert.throws(() => evaluatePanel(assessment), expected);
  }
});

test('CLI evaluates from a file without network or filesystem writes', t => {
  const home = mkdtempSync(path.join(tmpdir(), 'persona-evaluate-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const assessment = path.join(home, 'assessment.json');
  writeFileSync(assessment, JSON.stringify(input()));
  const guard = path.join(home, 'deny-network.cjs');
  writeFileSync(guard, `const deny = () => { throw new Error('Unexpected network call'); };\nglobalThis.fetch = deny;\nfor (const name of ['http', 'https']) { const mod = require('node:' + name); mod.request = deny; mod.get = deny; }\nconst net = require('node:net'); net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny;\n`);
  const before = readdirSync(home).map(name => [name, readFileSync(path.join(home, name), 'utf8')]);
  const result = spawnSync(process.execPath, ['--require', guard, cli, 'evaluate', assessment, '--json'], {
    cwd: home, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, HOME: home, PERSONA_LAB_HOME: path.join(home, 'library'), NODE_OPTIONS: '' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).incremental_issue_ids[0], 'trace');
  assert.deepEqual(readdirSync(home).map(name => [name, readFileSync(path.join(home, name), 'utf8')]), before);
  assert.doesNotMatch(result.stderr, /Unexpected network call/);
});
