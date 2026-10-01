#!/usr/bin/env node
/** Reproducible projection; never modifies the corpus or the user's persona library. */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function importLennyCatalog(sourceRoot) {
  const root = realpathSync(sourceRoot);
  const read = relative => {
    const target = realpathSync(path.resolve(root, relative));
    const rel = path.relative(root, target);
    if (path.isAbsolute(relative) || rel === '..' || rel.startsWith(`..${path.sep}`)) throw new Error('Source escapes corpus root');
    return readFileSync(target);
  };
  const taxonomyBytes = read('analysis/persona-library/taxonomy.json');
  const mappingsBytes = read('analysis/persona-library/speaker-mappings.jsonl');
  const taxonomy = JSON.parse(taxonomyBytes);
  const mappings = mappingsBytes.toString('utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  if (!Array.isArray(taxonomy.personas)) throw new Error('Taxonomy personas must be an array');
  const ids = new Set();
  const roles = taxonomy.personas.filter(role => {
    if (!role.id || ids.has(role.id)) throw new Error('Duplicate or missing role ID');
    ids.add(role.id);
    return role.kind === 'aggregate-expert-archetype';
  }).map(role => ({ id: role.id, name: role.name, primary_question: role.primary_question,
    owns: role.owns, excludes: role.excludes, keywords: role.keywords,
    status: role.status, evidence_status: role.evidence_status, review_contract: role.review_contract, sources: [] }));
  const roleById = new Map(roles.map(role => [role.id, role]));
  const speakerIds = new Set();
  const files = new Map();
  let verifiedSpans = 0;
  for (const speaker of mappings) {
    if (!speaker.speaker_id || speakerIds.has(speaker.speaker_id)) throw new Error('Duplicate or missing speaker ID');
    speakerIds.add(speaker.speaker_id);
    if (!Array.isArray(speaker.persona_assignments)) throw new Error(`Missing persona assignments: ${speaker.name}`);
    const assigned = new Set();
    for (const assignment of speaker.persona_assignments) {
      if (!ids.has(assignment.persona_id) || assigned.has(assignment.persona_id)) throw new Error('Unknown or duplicate role assignment');
      assigned.add(assignment.persona_id);
      if (!Array.isArray(assignment.evidence)) throw new Error(`Missing assignment evidence: ${speaker.name}`);
      for (const evidence of assignment.evidence) {
        if (!files.has(evidence.source_path)) {
          const bytes = read(evidence.source_path);
          files.set(evidence.source_path, { hash: sha(bytes), points: [...bytes.toString('utf8')] });
        }
        const file = files.get(evidence.source_path);
        const { source_start: start, source_end: end } = evidence;
        if (evidence.anchor_space !== 'original_source_codepoints_v1' || file.hash !== evidence.source_sha256 ||
          !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > file.points.length ||
          file.points.slice(start, end).join('') !== evidence.excerpt || sha(evidence.excerpt) !== evidence.excerpt_sha256) {
          throw new Error(`Invalid source evidence: ${speaker.name} / ${assignment.persona_id}`);
        }
        verifiedSpans++;
      }
      const role = roleById.get(assignment.persona_id);
      if (!role || speaker.eligible_for_expert_aggregation !== true || speaker.source_only !== false || speaker.identity_kind !== 'identified-person') continue;
      if (!assignment.evidence.length) throw new Error('Expert mapping has no evidence');
      role.sources.push({ speaker_id: speaker.speaker_id, name: speaker.name,
        mapping_status: assignment.mapping_status, basis: assignment.basis, evidence: assignment.evidence });
    }
  }
  for (const role of roles) {
    if (!role.sources.length) throw new Error(`Role has no eligible sources: ${role.id}`);
    role.sources.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }
  return { version: 1, source: 'Lenny podcast local persona index', source_date: taxonomy.created,
    source_files: { taxonomy: sha(taxonomyBytes), speaker_mappings: sha(mappingsBytes) },
    policy: 'Draft role and speaker mappings generate review hypotheses. Candidate passages are source locators, not validated expertise or guest endorsement. Inspect context; preserve disagreements; do not impersonate speakers.',
    integrity: { speaker_records: mappings.length, verified_spans: verifiedSpans, verified_files: files.size,
      expert_speakers: new Set(roles.flatMap(role => role.sources.map(source => source.speaker_id))).size },
    roles };
}
export const serializeCatalog = catalog => `export default ${JSON.stringify(catalog)};\n`;
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const root = args[args.indexOf('--source') + 1];
    if (!args.includes('--source') || !root) throw new Error('Usage: node scripts/import-lenny-catalog.mjs --source <corpus-root> [--check]');
    const output = new URL('../lib/data/lenny-catalog.mjs', import.meta.url);
    const catalog = importLennyCatalog(root);
    const content = serializeCatalog(catalog);
    if (args.includes('--check')) {
      if (readFileSync(output, 'utf8') !== content) throw new Error('Bundled catalog differs; rerun import');
    } else writeFileSync(output, content);
    console.log(JSON.stringify({ roles: catalog.roles.length, ...catalog.integrity, unchanged: args.includes('--check') }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
