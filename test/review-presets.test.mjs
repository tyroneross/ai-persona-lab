import test from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_PRESETS, buildReviewBrief } from '../lib/review-presets.mjs';
import { findRole } from '../lib/roles.mjs';

test('every versioned starter panel is bounded, independent and adversarial', () => {
  assert.equal(new Set(REVIEW_PRESETS.map(p => p.id)).size, REVIEW_PRESETS.length);
  for (const p of REVIEW_PRESETS) {
    assert.equal(p.version, 1);
    assert.equal(p.lenses.length, 3);
    assert.equal(new Set(p.lenses.map(l => l.role)).size, 3);
    assert.ok(p.lenses.every(l => findRole(l.role)));
    assert.ok(p.lenses.some(l => findRole(l.role).adversarial));
    assert.ok(p.lenses.every(l => l.recall !== 'all'));
    assert.ok(p.lenses.filter(l => l.role === 'novice').every(l => l.recall === 'none'));
  }
});
test('brief requires a frozen locator and question, preserves evidence and scope without extra reviewers', () => {
  const preset = REVIEW_PRESETS[0];
  assert.throws(() => buildReviewBrief(preset, { artifact: ' ', decision: 'Review' }));
  assert.throws(() => buildReviewBrief(preset, { artifact: 'repo/file@abc', decision: '' }));
  const input = { artifact: 'repo/file@abc', decision: 'Can the receiver act?', constraints: 'Read only', personas: [{ id: 'p1', name: 'Operator', recall: 'all' }] };
  const before = JSON.stringify(input);
  const text = buildReviewBrief(preset, input);
  for (const phrase of ['repo/file@abc', 'Can the receiver act?', 'Read only', 'provenance=unspecified', 'not additional reviewers', 'tracked and untracked', 'sent from acknowledged', 'not a hard token cap', 'not enforcement']) assert.ok(text.includes(phrase), phrase);
  assert.equal(JSON.stringify(input), before);
  assert.equal(text, buildReviewBrief(preset, input));
});

test('one fresh reviewer is default; independent panel must be explicitly selected', () => {
  const input = { artifact: 'file@commit', decision: 'Review' };
  const single = buildReviewBrief(REVIEW_PRESETS[0], input);
  assert.ok(single.includes('one general reviewer'));
  assert.ok(!single.includes('recall=project'));
  const panel = buildReviewBrief(REVIEW_PRESETS[0], { ...input, mode: 'panel' });
  assert.ok(panel.includes('three independent reviewers'));
  assert.ok(panel.includes('recall=project'));
});
