import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { digest, scanCorpus, ingestCorpus, verifyPrinciples, reviewedPrinciples, phrasePresent, searchSources } from '../lib/sources.mjs';
import { ARCHETYPE_CATALOG } from '../lib/archetypes.mjs';

test('reviewed seed principles carry resolvable catalog roles and precise provenance', () => {
  const entries = reviewedPrinciples();
  assert.equal(entries.length, 40);
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  for (const e of entries) {
    for (const key of ['principle', 'use_when', 'avoid_when']) assert.ok(e[key]?.trim());
    assert.ok(e.archetypes.every(id => ARCHETYPE_CATALOG.archetypes.some(a => a.id === id)), e.id);
    assert.match(e.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(e.source.line_start > 0 && e.source.line_end >= e.source.line_start);
    assert.ok(e.source.speaker);
  }
});

test('manifest ingestion is idempotent and fail-closed on altered or unmanifested sources', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'persona-corpus-'));
  const previous = process.env.PERSONA_LAB_HOME;
  process.env.PERSONA_LAB_HOME = path.join(root, 'library');
  try {
    mkdirSync(path.join(root, 'transcripts/raw'), { recursive: true });
    const text = `Guest (00:01)\nA product marketing launch needs customer research and zygomorphic examples.\n${'context '.repeat(60)}lateparagraphmatch\n`;
    const sha = digest(text);
    const file = path.join(root, 'transcripts/raw/Guest.txt');
    writeFileSync(file, text);
    writeFileSync(path.join(root, 'transcripts/MANIFEST.sha256'), `${sha}  raw/Guest.txt\n`);
    const first = ingestCorpus(root);
    assert.equal(first.episode_count, 1);
    assert.equal(first.unchanged, false);
    const before = readFileSync(first.file, 'utf8');
    assert.equal(ingestCorpus(root).unchanged, true);
    assert.equal(searchSources('zygomorphic').results.length, 1);
    const late = searchSources('lateparagraphmatch').results[0].candidate_spans[0];
    assert.equal(late.line, 3);
    assert.ok(late.column_start > 300);
    assert.match(late.text, /lateparagraphmatch/);
    assert.ok(late.text.length <= 300);
    const source = { path: 'transcripts/raw/Guest.txt', sha256: sha, line_start: 1, line_end: 2 };
    assert.equal(verifyPrinciples(root, [{ id: 'test', source }]).ok, true);
    assert.equal(verifyPrinciples(root, [{ id: 'test', source: { ...source, line_end: 99 } }]).ok, false);
    writeFileSync(file, 'changed');
    assert.throws(() => ingestCorpus(root), /mismatch/);
    assert.throws(() => searchSources('product'), /changed since ingestion/);
    assert.equal(readFileSync(first.file, 'utf8'), before);
    assert.equal(verifyPrinciples(root, [{ id: 'test', source }]).ok, false);
    writeFileSync(file, text);
    writeFileSync(path.join(root, 'transcripts/raw/extra.txt'), 'extra');
    assert.equal(scanCorpus(root).unmanifested_files.length, 1);
    assert.throws(() => ingestCorpus(root), /unmanifested/);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('source references cannot traverse or symlink outside the registered corpus', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'persona-corpus-paths-'));
  try {
    mkdirSync(path.join(root, 'corpus'));
    writeFileSync(path.join(root, 'outside.txt'), 'outside');
    symlinkSync(path.join(root, 'outside.txt'), path.join(root, 'corpus/link.txt'));
    for (const ref of ['../outside.txt', 'link.txt', path.join(root, 'outside.txt')]) {
      assert.equal(verifyPrinciples(path.join(root, 'corpus'), [{ id: 'escape', source: { path: ref } }]).ok, false);
    }
    assert.equal(phrasePresent('building hardware', 'ui'), false);
    assert.equal(phrasePresent('UI review', 'ui'), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
