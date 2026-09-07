import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ARCHETYPE_CATALOG, composePersona, parseSpecialties, planConsultation } from '../lib/archetypes.mjs';
import { validatePersona, savePersona } from '../lib/library.mjs';

test('every professional archetype produces a valid, evidence-labelled persona', () => {
  for (const a of ARCHETYPE_CATALOG.archetypes) {
    const result = composePersona({ archetypes: [a.id] });
    assert.deepEqual(validatePersona(result.persona), { ok: true, errors: [] }, a.id);
    assert.equal(result.reminder, 'hypothesis, not validation');
    assert.ok(result.persona.evidence.some(e => e.source_type === 'synthetic'));
  }
});

test('overlapping roles and arbitrary-depth specialties compose without a closed taxonomy', () => {
  const parts = Array.from({ length: 40 }, (_, i) => `specialty-${i}`);
  const { persona, evidence_gaps } = composePersona({ archetypes: ['marketer', 'engineer'],
    specialties: [parts, ['product-marketing', 'hardware', 'networking']], name: 'Specialist hypothesis' });
  assert.deepEqual(persona.composition.archetype_ids, ['marketer', 'engineer']);
  assert.equal(persona.composition.specialty_paths[0].length, 40);
  assert.ok(evidence_gaps.includes('product-marketing/hardware/networking'));
  assert.equal(persona.confidence, 0.4);
  assert.throws(() => parseSpecialties('hardware//silicon'), /Specialties/);
  assert.throws(() => parseSpecialties('../outside'), /Specialties/);
});

test('source-supported parent role never implies silicon or sector-specific VC competence', () => {
  const investor = composePersona({ archetypes: ['investor'], specialties: 'venture-capital/vertical-saas/healthcare' });
  assert.ok(investor.principles.length);
  assert.deepEqual(investor.evidence_gaps, ['venture-capital/vertical-saas/healthcare']);
  const hardware = composePersona({ archetypes: ['engineer'], specialties: 'hardware/silicon' });
  assert.ok(hardware.evidence_gaps.includes('hardware/silicon'));
});

test('task planner labels automatic specialist inference and exposes domain gaps', () => {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-infer-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    const plan = planConsultation('Evaluate a healthcare vertical SaaS venture investment');
    assert.equal(plan.assignments[0].archetype_id, 'investor');
    assert.equal(plan.specialty_selection.source, 'keyword-candidates');
    assert.ok(plan.assignments[0].evidence_gaps.includes('healthcare'));
    assert.ok(plan.assignments[0].evidence_gaps.includes('vertical-saas'));
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('large specialty compositions retain metadata while bounding display fields', () => {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-deep-specialty-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    const plan = planConsultation('Plan a hardware networking product launch: product marketing, developer marketing, positioning, technical sales, enterprise sales, pricing, customer research, and executive communication.');
    assert.equal(plan.assignments.length, 5);
    assert.ok(plan.assignments.every(a => a.name.length <= 180));
    const parts = Array.from({ length: 200 }, (_, i) => `specialty-${i}`);
    const result = composePersona({ archetypes: ['engineer'], specialties: [parts] });
    assert.equal(result.persona.composition.specialty_paths[0].length, 200);
    assert.equal(result.evidence_gaps[0], parts.join('/'));
    assert.ok(result.persona.notes.length <= 2000);
    assert.ok(result.persona.name.length <= 180);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('consultant reuses exact saved specialty, plans UI roles and preserves a challenger', () => {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-archetypes-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    const stored = savePersona(composePersona({ archetypes: ['designer'], specialties: 'interaction-design' }).persona);
    const result = planConsultation('Plan an accessible checkout interface', { mode: 'ui-ux', specialties: 'interaction-design', project: 'test' });
    assert.equal(result.execution, 'plan-only');
    assert.equal(result.assignments.length, 5);
    assert.ok(result.assignments.some(a => a.archetype_id === 'accessibility'));
    assert.ok(result.assignments.some(a => a.archetype_id === 'red-team'));
    const reused = result.assignments.find(a => a.archetype_id === 'designer');
    assert.equal(reused.persona_id, stored.id);
    assert.deepEqual(reused.recall_command.slice(0, 3), ['persona', 'recall', stored.id]);
    const other = planConsultation('Design a networking switch', { archetypes: ['designer'], specialties: 'hardware/networking' });
    assert.equal(other.assignments.find(a => a.archetype_id === 'designer').source, 'composed-draft');
    assert.throws(() => planConsultation('Build', { count: 2 }), /count/);
    assert.throws(() => planConsultation('Build', { count: 3, archetypes: ['engineer', 'designer', 'marketer'] }), /count/);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('saved overlapping personas fill only one seat and coverage uses attached evidence', () => {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-seats-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    const draft = composePersona({ archetypes: ['marketer', 'engineer', 'red-team'], specialties: 'positioning', task: 'Review API' }).persona;
    assert.ok(draft.scenarios[0].description.length >= 20);
    draft.evidence = draft.evidence.filter(e => e.source_type === 'synthetic');
    draft.composition.evidence_ids = draft.evidence.map(e => e.id);
    const stored = savePersona(draft);
    const plan = planConsultation('Plan launch', { archetypes: ['marketer', 'engineer', 'red-team'], count: 3, specialties: 'positioning' });
    assert.equal(plan.assignments.filter(a => a.persona_id === stored.id).length, 1);
    const reused = plan.assignments.find(a => a.persona_id === stored.id);
    assert.deepEqual(reused.evidence_gaps, ['positioning']);
    assert.deepEqual(reused.recall_context_required, ['project']);
    assert.equal(reused.recall_command, null);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('CLI composes, saves, searches specialty metadata and returns machine consultation packets', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'persona-cli-compose-'));
  const env = { ...process.env, PERSONA_LAB_HOME: home };
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, ['bin/persona.mjs', ...args], { env, encoding: 'utf8' }));
  try {
    const result = cli('compose', 'marketer', '--specialties', 'product-marketing/hardware/networking', '--save');
    assert.ok(result.saved);
    assert.equal(JSON.parse(readFileSync(path.join(home, 'personas.json'))).personas.length, 1);
    const plan = cli('consult', 'Prepare a networking hardware product launch', '--archetypes', 'marketer', '--specialties', 'product-marketing/hardware/networking');
    assert.equal(plan.assignments[0].persona_id, result.persona.id);
    assert.equal(spawnSync(process.execPath, ['bin/persona.mjs', 'compose', 'imaginary-role'], { env }).status, 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
});
