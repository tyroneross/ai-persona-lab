import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { savePersona, searchPersonas, validatePersona, withSaveDefaults } from '../lib/library.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceId = 'evidence_interview_1234abcd';
const composition = {
  version: '1', archetype_ids: ['marketer', 'engineer'],
  specialty_paths: [['hardware', 'silicon', 'networking']], evidence_ids: [evidenceId],
};
function fixture(metadata = composition) {
  return withSaveDefaults({
    name: 'Cross-functional professional', archetype: 'Professional', role: 'Advisor',
    summary: 'A synthetic professional persona used to verify composable expertise.',
    primary_goal: 'Review the decision', goals: ['Surface constraints'],
    frustrations: ['Missing evidence'], motivations: ['Decision quality'],
    behaviors: ['Ask for evidence'], needs: ['Relevant source material'],
    scenarios: [{ title: 'Decision review', description: 'Review the task and identify important constraints.' }],
    evidence: [{ id: evidenceId, source_type: 'desk_research', summary: 'Source-backed perspective from a professional interview.', confidence: 0.6 }],
    confidence: 0.4, tags: [], composition: metadata,
  });
}

test('legacy personas remain valid and specialty paths have no fixed vocabulary or depth', () => {
  const legacy = fixture();
  delete legacy.composition;
  assert.equal(validatePersona(legacy).ok, true);
  for (const metadata of [composition,
    { ...composition, specialty_paths: [], evidence_ids: [] },
    { ...composition, archetype_ids: ['a-new-profession'], specialty_paths: [Array.from({ length: 100 }, (_, i) => `specialty-${i}`)] },
  ]) assert.deepEqual(validatePersona(fixture(metadata)), { ok: true, errors: [] });
});

test('malformed and dangling composition fails both library and CLI validation', () => {
  const cases = [null, [], 'metadata', {},
    { ...composition, version: 1 },
    { ...composition, archetype_ids: [] },
    { ...composition, archetype_ids: ['Invalid Label'] },
    { ...composition, specialty_paths: [[]] },
    { ...composition, specialty_paths: [['valid', 'invalid/name']] },
    { ...composition, specialty_paths: ['hardware'] },
    { ...composition, evidence_ids: ['unknown'] },
    { ...composition, evidence_ids: ['evidence_missing_1234abcd'] },
    { ...composition, evidence_ids: null },
    { ...composition, unexpected: true },
  ];
  for (const metadata of cases) {
    const persona = fixture(metadata);
    assert.equal(validatePersona(persona).ok, false, JSON.stringify(metadata));
    const result = spawnSync(process.execPath, [path.join(root, 'bin/persona.mjs'), 'validate', '-', '--json'],
      { input: JSON.stringify(persona), encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
});

test('saved composition is searchable by overlapping archetypes and full specialty path', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'persona-composition-'));
  const previousHome = process.env.PERSONA_LAB_HOME;
  process.env.PERSONA_LAB_HOME = home;
  try {
    const saved = savePersona(fixture());
    for (const query of ['marketer', 'engineer', 'silicon', 'hardware/silicon/networking']) {
      assert.deepEqual(searchPersonas(query).map(p => p.id), [saved.id], query);
    }
    assert.deepEqual(searchPersonas('unrelated'), []);
  } finally {
    if (previousHome === undefined) delete process.env.PERSONA_LAB_HOME;
    else process.env.PERSONA_LAB_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  }
});

test('canonical schema exposes optional open-ended composition with strict shapes', () => {
  const schema = JSON.parse(readFileSync(path.join(root, 'schemas/persona.schema.json'), 'utf8'));
  assert.equal(schema.required.includes('composition'), false);
  assert.equal(schema.properties.composition.$ref, '#/$defs/composition');
  const shape = schema.$defs.composition;
  assert.equal(shape.additionalProperties, false);
  assert.deepEqual(shape.required, ['version', 'archetype_ids', 'specialty_paths', 'evidence_ids']);
  assert.equal(shape.properties.version.const, '1');
  assert.equal(shape.properties.archetype_ids.minItems, 1);
  assert.equal(shape.properties.specialty_paths.items.minItems, 1);
  assert.equal(shape.properties.specialty_paths.items.maxItems, undefined);
  const slug = new RegExp(schema.$defs.composition_slug.pattern);
  assert.ok(slug.test('future-specialty-42'));
  assert.equal(slug.test('unstructured/path'), false);
  assert.ok(new RegExp(shape.properties.evidence_ids.items.pattern).test(evidenceId));
});
