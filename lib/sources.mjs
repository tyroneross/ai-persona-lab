/** Local corpus references and reviewed principles. Raw transcripts remain at source. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
const readData = name => JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8'));
export function reviewedPrinciples() {
  return ['lenny-leadership-evidence.json', 'lenny-product-evidence.json'].flatMap(readData);
}
export function sourceHome() {
  return path.join(process.env.PERSONA_LAB_HOME || path.join(os.homedir(), '.persona-lab'), 'sources');
}
export function registeredCorpus() {
  const file = path.join(sourceHome(), 'lenny-podcast.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
function within(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Source path must be relative');
  const target = path.resolve(root, relative);
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Source path escapes corpus root');
  const real = realpathSync(target);
  const realRel = path.relative(realpathSync(root), real);
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) throw new Error('Source symlink escapes corpus root');
  return target;
}
export function verifyPrinciples(root, principles = reviewedPrinciples()) {
  const results = principles.map(item => {
    try {
      const source = item.source;
      const bytes = readFileSync(within(path.resolve(root), source.path));
      const lines = bytes.toString('utf8').split(/\r?\n/);
      if (digest(bytes) !== source.sha256) throw new Error('Source hash differs');
      if (!Number.isInteger(source.line_start) || !Number.isInteger(source.line_end) ||
          source.line_start < 1 || source.line_end < source.line_start || source.line_end > lines.length) {
        throw new Error('Invalid source line span');
      }
      if (!lines.slice(source.line_start - 1, source.line_end).join('\n').trim()) throw new Error('Empty source span');
      return { id: item.id, ok: true };
    } catch (error) { return { id: item.id, ok: false, error: error.message }; }
  });
  return { ok: results.every(r => r.ok), checked: results.length, results,
    scope: 'Hashes and line boundaries verified; semantic applicability remains a reviewed interpretation.' };
}

/** Build a reproducible lexical index over every manifest entry; no model calls. */
export function scanCorpus(root) {
  root = realpathSync(path.resolve(root));
  const manifest = readFileSync(path.join(root, 'transcripts/MANIFEST.sha256'), 'utf8');
  const archetypes = readData('archetypes.json').archetypes;
  const episodes = [];
  for (const line of manifest.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (!match) throw new Error('Malformed corpus manifest entry');
    let relative = match[2];
    if (!relative.startsWith('transcripts/')) relative = `transcripts/${relative}`;
    const bytes = readFileSync(within(root, relative));
    const sha256 = digest(bytes);
    if (sha256 !== match[1].toLowerCase()) throw new Error(`Manifest mismatch: ${relative}`);
    const body = bytes.toString('utf8').toLowerCase();
    const candidate_archetypes = archetypes.map(a => ({ id: a.id,
      matched_terms: a.keywords.filter(term => phrasePresent(body, term)),
    })).filter(a => a.matched_terms.length);
    episodes.push({ path: relative, sha256, bytes: bytes.length,
      lines: bytes.toString('utf8').split(/\r?\n/).length, candidate_archetypes });
  }
  episodes.sort((a, b) => a.path.localeCompare(b.path));
  if (!episodes.length || new Set(episodes.map(e => e.path)).size !== episodes.length) throw new Error('Empty or duplicate manifest');
  // Detect unmanifested files as well as altered manifest entries.
  const raw = path.join(root, 'transcripts/raw');
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Raw corpus symlinks are not supported');
    return entry.isDirectory() ? walk(full) : [path.relative(root, full)];
  });
  const expected = new Set(episodes.map(e => e.path));
  const extras = walk(raw).filter(p => !expected.has(p));
  return { version: '1', corpus: 'lenny-podcast', root,
    fingerprint: digest(episodes.map(e => `${e.sha256}  ${e.path}`).join('\n')),
    manifest_sha256: digest(manifest), episode_count: episodes.length,
    classification: 'lexical-candidates-only', unmanifested_files: extras, episodes };
}
function phrasePattern(phrase) {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
}
export function phrasePresent(text, phrase) {
  return phrasePattern(phrase).test(text);
}
export function ingestCorpus(root) {
  const index = scanCorpus(root);
  if (index.unmanifested_files.length) throw new Error('Corpus contains unmanifested files; reconcile source manifest before ingestion');
  const file = path.join(sourceHome(), 'lenny-podcast.json');
  const content = `${JSON.stringify(index, null, 2)}\n`;
  const unchanged = existsSync(file) && readFileSync(file, 'utf8') === content;
  if (!unchanged) {
    mkdirSync(sourceHome(), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, content);
    renameSync(temporary, file);
  }
  return { file, unchanged, episode_count: index.episode_count, fingerprint: index.fingerprint,
    classification: index.classification, raw_transcripts_copied: false };
}

export function searchSources(query, { root, limit = 10 } = {}) {
  const index = root ? scanCorpus(root) : registeredCorpus();
  if (!index) throw new Error('No registered corpus. Run persona sources ingest --root <corpus-root>');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) throw new Error('Source search requires a query');
  return { classification: 'lexical-candidates-only', fingerprint: index.fingerprint,
    results: index.episodes.map(e => {
      const bytes = readFileSync(within(index.root, e.path));
      if (digest(bytes) !== e.sha256) throw new Error(`Source changed since ingestion: ${e.path}`);
      const lines = bytes.toString('utf8').split(/\r?\n/);
      const text = `${e.path} ${lines.join('\n')}`.toLowerCase();
      const spans = lines.flatMap((line, i) => {
        const matches = terms.map(term => line.search(phrasePattern(term))).filter(index => index >= 0);
        if (!matches.length) return [];
        const start = Math.max(0, Math.min(...matches) - 80);
        return [{ line: i + 1, column_start: start + 1, text: line.slice(start, start + 300) }];
      }).slice(0, 3);
      return { ...e, score: terms.filter(t => phrasePresent(text, t)).length, candidate_spans: spans };
    }).filter(e => e.score).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit) };
}
