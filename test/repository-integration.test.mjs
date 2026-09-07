import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('web uses the canonical persona schema without a second plugin copy', () => {
  assert.equal(realpathSync(path.join(root, 'apps/web/schemas/persona.schema.json')),
    realpathSync(path.join(root, 'schemas/persona.schema.json')));
  assert.equal(existsSync(path.join(root, 'apps/web/plugins/persona-lab')), false);
});

test('shared planner runs from web cwd and preserves its output contract', () => {
  const output = JSON.parse(execFileSync(process.execPath,
    [path.join(root, 'scripts/persona-plan.mjs'), '--json', '--count', '3', 'Review onboarding'],
    { cwd: path.join(root, 'apps/web'), encoding: 'utf8' }));
  assert.equal(output.personas.length, 3);
  for (const persona of output.personas) {
    for (const field of ['name', 'perspective', 'primaryQuestion', 'successSignal', 'failureSignal']) {
      assert.ok(persona[field], field);
    }
  }
  assert.ok(output.inferredIntent);
  assert.ok(Array.isArray(output.accessNeeds));
});

test('obsolete mirror refuses before writing or publishing', () => {
  const result = spawnSync('bash', [path.join(root, 'scripts/publish-sync.sh')], {
    env: { ...process.env, PERSONA_LAB_STANDALONE: '/must-not-be-written' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /retired/);
});

test('CLI distribution stays independent of Next.js', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies?.next, undefined);
  assert.equal(pkg.workspaces, undefined);
  assert.equal(pkg.files.includes('apps'), false);
});
