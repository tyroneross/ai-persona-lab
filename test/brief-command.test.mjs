import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../bin/persona.mjs', import.meta.url));
const base = ['brief', 'interface', '--artifact', 'src/form.tsx@abc123', '--question', 'Can I submit with a keyboard?'];

function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => [
    entry.name, entry.isDirectory() ? snapshot(path.join(dir, entry.name)) : readFileSync(path.join(dir, entry.name), 'utf8'),
  ]);
}

function fixture(t, personas = []) {
  const home = mkdtempSync(path.join(tmpdir(), 'persona-brief-cli-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const library = path.join(home, 'library');
  if (personas.length) {
    mkdirSync(library);
    writeFileSync(path.join(library, 'personas.json'), JSON.stringify({ personas }));
  }
  const guard = path.join(home, 'deny-network.cjs');
  writeFileSync(guard, `const deny = () => { throw new Error('Unexpected network call'); };
globalThis.fetch = deny;
for (const name of ['http', 'https']) { const mod = require('node:' + name); mod.request = deny; mod.get = deny; }
const net = require('node:net'); net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny;
`);
  return (args) => {
    const before = snapshot(home);
    const result = spawnSync(process.execPath, ['--require', guard, cli, ...args], {
      cwd: home, encoding: 'utf8', timeout: 5000,
      env: { ...process.env, HOME: home, PERSONA_LAB_HOME: library, NODE_OPTIONS: '' },
    });
    assert.ifError(result.error);
    assert.deepEqual(snapshot(home), before, 'planning command must not write files');
    assert.doesNotMatch(result.stderr, /Unexpected network call/);
    return result;
  };
}

test('brief defaults to one fresh reviewer and preserves artifact, question and scope without writes or network', (t) => {
  const run = fixture(t);
  const result = run([...base, '--constraints', 'Only keyboard and mobile; read only', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.execution, 'plan-only');
  assert.equal(plan.model_calls, 0);
  assert.equal(plan.writes, false);
  assert.equal(plan.effective_review_passes, 1);
  assert.equal(plan.additional_model_passes, 0);
  assert.equal(plan.artifact, 'src/form.tsx@abc123');
  assert.equal(plan.question, 'Can I submit with a keyboard?');
  assert.equal(plan.constraints, 'Only keyboard and mobile; read only');
  assert.match(plan.brief, /one general reviewer/);
  assert.doesNotMatch(plan.brief, /recall=project/);
  assert.match(run(base).stdout, /host executes reviews/);
});

test('all presets generate a brief; explicit panel has three reviews and saved references add none', (t) => {
  const run = fixture(t, [{ id: 'persona_saved', name: 'Saved operator', recall: 'all' }]);
  for (const preset of ['handoff', 'interface', 'decision']) {
    const args = [...base]; args[1] = preset;
    const result = run([...args, '--mode', 'panel', '--personas', 'persona_saved', '--json']);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.requested_review_passes, 3);
    assert.equal(plan.effective_review_passes, 3);
    assert.match(plan.brief, /not additional reviewers/);
    assert.match(plan.brief, /apply the lens recall restriction/);
  }
});

test('brief rejects absent and missing flag values, unknown flags, preset, mode and IDs without writes', (t) => {
  const run = fixture(t);
  const invalid = [
    [['brief', 'interface'], /artifact/],
    [['brief', 'interface', '--artifact', 'form@v1'], /question/],
    [['brief', 'unknown', ...base.slice(2)], /unknown preset/],
    [[...base, '--mode', 'many'], /unknown mode/],
    [[...base, '--personas', 'not_saved'], /unknown saved persona ID/],
    [[...base, '--personas', 'a,,b'], /nonempty/],
    [[...base, '--personas', 'a,a'], /distinct/],
    [[...base, '--typo'], /unknown option/],
    [[...base, '--count', '4'], /unknown option/],
    [['brief', 'interface', '--artifact', 'form', '--question', 'Review'], /locator@version/],
    [['brief', 'interface', '--artifact', 'form@', '--question', 'Review'], /locator@version/],
  ];
  for (const flag of ['artifact', 'question', 'constraints', 'mode', 'personas']) {
    invalid.push([['brief', 'interface', `--${flag}`], new RegExp(`--${flag} requires a value`)]);
    invalid.push([['brief', 'interface', `--${flag}`, '--json'], new RegExp(`--${flag} requires a value`)]);
  }
  for (const [args, message] of invalid) {
    const result = run(args);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  }
});

test('panel honors supported counts and retains accessibility plus adversary within UI budget', (t) => {
  const run = fixture(t);
  for (const [level, count] of [['low', 3], ['low', 4], ['medium', 4], ['medium', 6], ['high', 6], ['high', 8]]) {
    const result = run(['panel', 'Review UI design visual layout engineering architecture', '--auto', '--level', level, '--count', String(count), '--json']);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.requested_review_passes, count);
    assert.equal(plan.effective_review_passes, count);
    assert.equal(plan.lenses.length, count);
    assert.ok(plan.lenses.some((lens) => lens.perspective === 'accessibility'));
    assert.ok(plan.lenses.some((lens) => lens.adversarial));
    assert.equal(new Set(plan.lenses.map((lens) => lens.perspective)).size, count);
    if (level !== 'high') assert.equal(plan.additional_model_passes, 0);
  }
});

test('panel rejects incompatible, fractional, malformed and valueless counts rather than clamping', (t) => {
  const run = fixture(t);
  for (const count of ['1', '5', '3.5', '3x', '0', '-3']) {
    const result = run(['panel', 'Review UI', '--level', 'low', '--count', count, '--json']);
    assert.notEqual(result.status, 0, count);
    assert.match(result.stderr, /--count for low must be an integer from 3 to 4/);
  }
  for (const flag of ['level', 'count', 'roster']) {
    const result = run(['panel', 'Review UI', `--${flag}`, '--json']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`--${flag} requires a value`));
  }
  assert.match(run(['panel', 'Review UI', '--level', 'unknown']).stderr, /unknown level/);
  assert.match(run(['panel', 'Review UI', '--bogus']).stderr, /unknown option/);
});

test('help distinguishes CLI planning from host execution and documents count bounds', (t) => {
  const help = fixture(t)(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /persona brief/);
  assert.match(help.stdout, /LLM host executes reviews/);
  assert.match(help.stdout, /low 3–4, medium 4–6, high 6–8/);
});
