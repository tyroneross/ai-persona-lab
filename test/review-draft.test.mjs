import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReviewDraft, parseReviewDraft } from '../lib/review-draft.mjs';
import { REVIEW_PRESETS, buildReviewBrief } from '../lib/review-presets.mjs';

test('tab recovery preserves all user inputs and reference selections', () => {
  const draft = { ...emptyReviewDraft(), artifact: 'repo/ui@abc', decision: 'Can I recover?', constraints: 'read only', mode: 'panel', presetId: 'interface', selected: ['p1', 'p2'] };
  assert.deepEqual(parseReviewDraft(JSON.stringify(draft)), draft);
});
test('malformed or incompatible storage fails safely without poisoning controls', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', '{"version":2}']) assert.deepEqual(parseReviewDraft(raw), emptyReviewDraft());
  const restored = parseReviewDraft(JSON.stringify({ version: 1, presetId: 'unknown', mode: 'spend-more', selected: ['p1', 1, 'p1'], artifact: {}, decision: 'kept' }));
  assert.equal(restored.presetId, 'handoff'); assert.equal(restored.mode, 'single');
  assert.equal(restored.artifact, ''); assert.equal(restored.decision, 'kept'); assert.deepEqual(restored.selected, ['p1']);
});
test('portable references include profile meaning, not only local IDs, without adding passes', () => {
  const brief = buildReviewBrief(REVIEW_PRESETS[1], { artifact: 'ui@abc', decision: 'Review', personas: [{ id: 'p1', name: 'Operator', role: 'Keyboard user', primary_goal: 'Complete a review', summary: 'Uses keyboard navigation', recall: 'all' }] });
  for (const text of ['Keyboard user', 'Complete a review', 'Uses keyboard navigation', 'not additional reviewers', 'one general reviewer', 'No encounter history']) assert.ok(brief.includes(text), text);
});
