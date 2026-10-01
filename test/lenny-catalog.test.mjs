import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LENNY_CATALOG, selectLennyPersonas, browseLennyRoles, resolveLennySelections } from '../lib/lenny-catalog.mjs';
import { importLennyCatalog, serializeCatalog } from '../scripts/import-lenny-catalog.mjs';
import { emptyReviewDraft, parseReviewDraft } from '../lib/review-draft.mjs';
import { REVIEW_PRESETS, buildReviewBrief } from '../lib/review-presets.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('catalog retains distinct expert roles, overlapping sources and provisional evidence', () => {
  assert.equal(LENNY_CATALOG.roles.length, 50);
  assert.equal(LENNY_CATALOG.integrity.expert_speakers, 315);
  assert.equal(new Set(LENNY_CATALOG.roles.map(role => role.id)).size, 50);
  assert.ok(LENNY_CATALOG.roles.every(role => role.sources.length && role.owns && role.excludes));
  const names = LENNY_CATALOG.roles.flatMap(role => role.sources.map(source => source.name));
  for (const excluded of ['Adam Grant', 'Elon Musk', 'MUSIC', 'Advertisement']) assert.ok(!names.includes(excluded), excluded);
  assert.ok(browseLennyRoles('Nancy Duarte').length > 1);
  assert.ok(LENNY_CATALOG.roles.every(role => role.sources.every(source => source.mapping_status === 'curated-hypothesis')));
});
test('selection separates adjacent responsibilities and explains source terms and authored aliases', () => {
  const result = selectLennyPersonas('Review onboarding and pricing for a subscription');
  assert.deepEqual(result.results.map(item => item.role_id), ['monetization', 'activation']);
  assert.deepEqual(result.results[0].matched_aliases, ['subscription']);
  assert.match(result.results[0].reason, /pricing/);
  for (const [query, role] of [['API integration documentation', 'developer-experience'], ['public speaking', 'speaking'], ['pitch deck', 'argument'], ['agent delegation workflow', 'agent-workflows'], ['fine tuning a model', 'model-engineering']]) {
    assert.equal(selectLennyPersonas(query).results[0].role_id, role, query);
  }
  assert.equal(selectLennyPersonas('Review fine-tuned models').results[0].role_id, 'model-engineering');
  assert.ok(selectLennyPersonas('Improve metrics and experiments').results.some(item => item.role_id === 'analytics'));
  assert.ok(selectLennyPersonas('Improve metrics and experiments').results.some(item => item.role_id === 'experimentation'));
  assert.ok(selectLennyPersonas('How do we evaluate AI agents?').results.some(item => item.role_id === 'ai-evaluation'));
  assert.equal(selectLennyPersonas('Activation journey reviewer').results[0].score, selectLennyPersonas('Activation journeys reviewer').results[0].score);
  assert.equal(selectLennyPersonas('API integration').results[0].score, selectLennyPersonas('API integrations').results[0].score);
  assert.ok(selectLennyPersonas('Nancy Duarte').results.some(item => item.matched_speakers.includes('Nancy Duarte')));
});
test('generic aliases require domain context and speaker names tolerate accents', () => {
  for (const query of ['Evaluate the pricing', 'Evaluate a hiring candidate']) assert.ok(!selectLennyPersonas(query).results.some(r => r.role_id === 'ai-evaluation'));
  assert.ok(!selectLennyPersonas('Review HR docs').results.some(r => r.role_id === 'developer-experience'));
  assert.ok(!selectLennyPersonas('Cancel an order').results.some(r => r.role_id === 'retention'));
  assert.ok(selectLennyPersonas('Review subscription cancellations').results.some(r => r.role_id === 'retention'));
  assert.ok(selectLennyPersonas('Meditation').results.some(r => r.role_id === 'self-regulation'));
  assert.ok(selectLennyPersonas('Manufactured devices').results.some(r => r.role_id === 'hardware'));
  assert.deepEqual(selectLennyPersonas('Tobi Lutke').results, selectLennyPersonas('Tobi Lütke').results);
  assert.ok(browseLennyRoles('Tobi Lutke').length);
});

test('empty, generic and substring-only requests abstain, rather than fabricate a panel', () => {
  for (const query of ['', 'hello', 'how why tell me', 'this surprising pirate sprinter']) assert.deepEqual(selectLennyPersonas(query).results, [], query);
  assert.throws(() => selectLennyPersonas('pricing', { limit: NaN }), /positive integer/);
});
test('brief and tab recovery preserve role-specific source choices without adding passes', () => {
  const role = LENNY_CATALOG.roles.find(item => item.id === 'monetization');
  const source = role.sources[0];
  const selections = [{ role_id: role.id, speaker_ids: [source.speaker_id] }];
  const draft = { ...emptyReviewDraft(), lennySelections: selections, decision: 'pricing' };
  assert.deepEqual(parseReviewDraft(JSON.stringify(draft)), draft);
  const brief = buildReviewBrief(REVIEW_PRESETS[2], { artifact: 'pricing@abc', decision: 'pricing', lennySelections: selections });
  for (const text of [role.name, role.owns, role.excludes, source.name, source.evidence[0].source_sha256, 'not extra reviewer passes', 'one general reviewer', 'Candidate passage']) assert.ok(brief.includes(text), text);
  assert.ok(!brief.includes('\n\n\n'));
  assert.ok(!buildReviewBrief(REVIEW_PRESETS[2], { artifact: 'test@abc', decision: 'Review' }).includes('\n\n\n'));
  for (const passage of source.evidence) assert.ok(brief.includes(`codepoints=${passage.source_start}:${passage.source_end}`));
  assert.deepEqual(parseReviewDraft(JSON.stringify({ ...draft, lennySelections: [{ role_id: role.id, speaker_ids: [source.speaker_id, 'stale-speaker'] }] })).lennySelections, selections);
  const wrongSource = LENNY_CATALOG.roles.flatMap(r => r.sources).find(s => !role.sources.some(item => item.speaker_id === s.speaker_id));
  assert.throws(() => resolveLennySelections([{ role_id: role.id, speaker_ids: [wrongSource.speaker_id] }]), /not mapped/);
  assert.throws(() => resolveLennySelections([{ role_id: 'bogus' }]), /Unknown/);
  const restored = parseReviewDraft(JSON.stringify({ ...draft, lennySelections: [...selections, { role_id: 'bogus', speaker_ids: [] }] }));
  assert.deepEqual(restored.lennySelections, selections);
  assert.equal(parseReviewDraft(JSON.stringify({ ...draft, lennySelections: [{ role_id: role.id, speaker_ids: [wrongSource.speaker_id] }] })).decision, 'pricing');
});
test('import verifies original Unicode and CRLF spans, rejects changed evidence and excludes ineligible identities', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lenny-import-'));
  try {
    mkdirSync(path.join(root, 'analysis/persona-library'), { recursive: true });
    mkdirSync(path.join(root, 'transcripts/raw'), { recursive: true });
    const raw = '😀\r\nSpeaker: Pricing matters.\r\n';
    writeFileSync(path.join(root, 'transcripts/raw/test.txt'), raw);
    const excerpt = 'Pricing matters.';
    const start = [...raw].join('').indexOf('Pricing') - 1; // Astral emoji occupies one codepoint, two UTF-16 units.
    const evidence = { source_path: 'transcripts/raw/test.txt', source_sha256: sha(raw), anchor_space: 'original_source_codepoints_v1', source_start: start, source_end: start + excerpt.length, excerpt, excerpt_sha256: sha(excerpt) };
    writeFileSync(path.join(root, 'analysis/persona-library/taxonomy.json'), JSON.stringify({ created: '2026-09-30', personas: [{ id: 'pricing', kind: 'aggregate-expert-archetype', name: 'Pricing advisor', keywords: ['pricing'] }] }));
    const speaker = { speaker_id: 's1', name: 'A speaker', identity_kind: 'identified-person', eligible_for_expert_aggregation: true, source_only: false, persona_assignments: [{ persona_id: 'pricing', mapping_status: 'curated-hypothesis', evidence: [evidence] }] };
    const mappingFile = path.join(root, 'analysis/persona-library/speaker-mappings.jsonl');
    const writeMappings = speakers => writeFileSync(mappingFile, speakers.map(s => JSON.stringify(s)).join('\n') + '\n');
    writeMappings([speaker, { ...speaker, speaker_id: 'advert', source_only: true }, { ...speaker, speaker_id: 'invalid-flag', eligible_for_expert_aggregation: 'true' }]);
    const imported = importLennyCatalog(root);
    assert.equal(imported.roles[0].sources.length, 1);
    assert.equal(serializeCatalog(imported), serializeCatalog(importLennyCatalog(root)));
    writeFileSync(path.join(root, 'transcripts/raw/test.txt'), raw.replace('matters', 'changes'));
    assert.throws(() => importLennyCatalog(root), /Invalid source evidence/);
    writeFileSync(path.join(root, 'transcripts/raw/test.txt'), raw);
    writeMappings([{ ...speaker, persona_assignments: [{ ...speaker.persona_assignments[0], evidence: [{ ...evidence, source_start: start + 1 }] }] }]);
    assert.throws(() => importLennyCatalog(root), /Invalid source evidence/);
    writeMappings([{ ...speaker, persona_assignments: [{ ...speaker.persona_assignments[0], persona_id: 'unknown' }] }]);
    assert.throws(() => importLennyCatalog(root), /Unknown or duplicate/);
    writeMappings([{ ...speaker, persona_assignments: undefined }]);
    assert.throws(() => importLennyCatalog(root), /Missing persona assignments/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('CLI and canonical planner expose the same task-to-role mapping', () => {
  const query = 'onboarding pricing subscription';
  const expected = selectLennyPersonas(query).results.map(item => item.role_id);
  const cli = JSON.parse(execFileSync(process.execPath, ['bin/persona.mjs', 'lenny', query, '--select', '--json'], { encoding: 'utf8' }));
  assert.deepEqual(cli.results.map(item => item.role_id), expected);
  const optionFirst = JSON.parse(execFileSync(process.execPath, ['bin/persona.mjs', 'lenny', '--select', query, '--json'], { encoding: 'utf8' }));
  assert.deepEqual(optionFirst.results.map(item => item.role_id), expected);
  assert.equal(optionFirst.task, query);
  assert.throws(() => execFileSync(process.execPath, ['bin/persona.mjs', 'lenny', query, '--select', '--count'], { stdio: 'pipe' }), error => error.status === 1);
  assert.throws(() => execFileSync(process.execPath, ['bin/persona.mjs', 'lenny', query, '--count', '3'], { stdio: 'pipe' }), error => error.status === 1);
  for (const value of ['0', 'abc', '2.5']) assert.throws(() => execFileSync(process.execPath, ['bin/persona.mjs', 'lenny', query, '--select', '--count', value], { stdio: 'pipe' }), error => error.status === 1 && error.stderr.toString().trim() === 'persona: Selection limit must be a positive integer');
  const planner = JSON.parse(execFileSync(process.execPath, ['scripts/persona-plan.mjs', query, '--json'], { encoding: 'utf8', input: '' }));
  assert.deepEqual(planner.lennySelection.results.map(item => item.role_id), expected);
});
