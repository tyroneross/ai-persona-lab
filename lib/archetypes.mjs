/** Professional archetypes compose with open specialty paths; review lenses stay independent. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { findRole } from './roles.mjs';
import { withSaveDefaults, listPersonas } from './library.mjs';
import { reviewedPrinciples, phrasePresent } from './sources.mjs';

export const ARCHETYPE_CATALOG = JSON.parse(readFileSync(new URL('./data/archetypes.json', import.meta.url), 'utf8'));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function findArchetype(id) {
  const found = ARCHETYPE_CATALOG.archetypes.find(a => a.id === id);
  if (!found) throw new Error(`Unknown archetype: ${id}. Use persona archetypes to browse.`);
  return found;
}
export function parseSpecialties(value = '') {
  const paths = Array.isArray(value) ? value : String(value).split(',').filter(Boolean).map(p => p.trim().split('/'));
  for (const parts of paths) {
    if (!Array.isArray(parts) || !parts.length || !parts.every(s => typeof s === 'string' && SLUG.test(s))) {
      throw new Error('Specialties must be nonempty slug paths, e.g. product-marketing,hardware/networking');
    }
  }
  return [...new Map(paths.map(p => [p.join('/'), [...p]])).values()];
}
const evidenceId = id => `evidence_${id}_${createHash('sha256').update(id).digest('hex').slice(0, 8)}`;
const evidenceUri = e => `lenny-corpus:${encodeURI(e.source.path)}#L${e.source.line_start}-L${e.source.line_end};sha256=${e.source.sha256}`;
const human = slug => slug.replaceAll('-', ' ');
export function inferSpecialties(task) {
  const candidates = new Set([
    ...ARCHETYPE_CATALOG.archetypes.flatMap(a => a.specialty_examples.flat()),
    ...reviewedPrinciples().flatMap(e => e.specialties),
    'saas', 'b2b', 'healthcare', 'fintech', 'education', 'silicon', 'networking', 'vertical-saas',
  ]);
  return [...candidates].filter(slug => phrasePresent(task, human(slug)) || phrasePresent(task, slug))
    .sort().map(slug => [slug]);
}
function matchesSpecialty(item, path) {
  // Never upgrade a broad mention to a deeper specialty. Every segment must be supported.
  return path.every(segment => item.specialties.includes(segment) || item.specialties.includes(path.join('/')));
}
export function composePersona({ archetypes, specialties = [], task = '', name } = {}) {
  const ids = [...new Set(Array.isArray(archetypes) ? archetypes : String(archetypes || '').split(',').filter(Boolean))];
  if (!ids.length) throw new Error('At least one archetype is required');
  if (String(task).length > 400) throw new Error('Composition task must be at most 400 characters');
  const bases = ids.map(findArchetype);
  const paths = parseSpecialties(specialties);
  const relevant = reviewedPrinciples().filter(e => e.archetypes.some(id => ids.includes(id)));
  const taskTerms = [...new Set(String(task).toLowerCase().split(/[^a-z0-9-]+/).filter(t =>
    t.length > 3 && !['this', 'that', 'with', 'from', 'have', 'help', 'work', 'task'].includes(t)))];
  const relevance = e => paths.filter(p => matchesSpecialty(e, p)).length * 100 +
    taskTerms.filter(t => phrasePresent(`${e.principle} ${e.use_when}`, t)).length;
  const selected = [...relevant].sort((a, b) =>
    relevance(b) - relevance(a) || a.id.localeCompare(b.id)
  ).slice(0, 6);
  const gaps = paths.filter(p => !selected.some(e => matchesSpecialty(e, p))).map(p => p.join('/'));
  const role = findRole(bases[0].lens);
  const goal = bases[0].goal;
  const fullLabel = name || bases.map(b => b.name).join(' + ') + (paths.length ? ` — ${paths.map(p => p.map(human).join(' / ')).join(' + ')}` : '');
  if (name && name.length > 180) throw new Error('Composed display name is too long; provide a shorter --name');
  const label = fullLabel.length > 180 ? `${fullLabel.slice(0, 177)}...` : fullLabel;
  const evidence = selected.map(e => ({
    id: evidenceId(e.id), source_type: 'desk_research', title: e.id,
    source_uri: evidenceUri(e),
    summary: `${e.source.speaker}: ${e.principle} Use: ${e.use_when} Limits: ${e.avoid_when}`.slice(0, 800),
    confidence: 0.5,
  }));
  evidence.push({ id: evidenceId('archetype-composition'), source_type: 'synthetic',
    summary: 'Archetype goals, specialty selection and task adaptation are synthetic hypotheses. Transcript principles are background evidence, not proof of specialist competence or guest endorsement.', confidence: 0.4 });
  const persona = withSaveDefaults({
    name: label, archetype: bases.map(b => b.name).join(' + '), role: bases[0].name,
    summary: `${goal} Applies ${selected.length ? 'selected podcast principles' : 'a synthetic professional perspective'} to the task. Specialty depth and applicability require independent evidence.`,
    primary_goal: goal,
    job_to_be_done: 'When facing a professional decision, I want to examine relevant constraints and evidence so I can choose and test a defensible next step.',
    goals: bases.map(b => b.goal), frustrations: bases.map(b => b.failure),
    motivations: ['Produce a useful decision and learn from evidence that could change it.'],
    behaviors: [...new Set([...bases.flatMap(b => b.practices), ...selected.map(e => e.principle)])],
    needs: ['Task context, intended outcome, constraints and source evidence.'],
    anti_goals: ['Impersonating a podcast guest or claiming validated expertise from an interview.', ...gaps.map(g => `Assuming unsupported specialty competence in ${g}.`)],
    scenarios: [{ title: 'Professional task consultation', description: task ? `Examine this professional task: ${task}` : 'Review a concrete professional task, identify alternatives and evidence gaps, then propose an observable next step.' }],
    evidence, provenance: selected.length ? 'synthetic-grounded' : 'synthetic-assumed', confidence: 0.4,
    tags: [...new Set([...ids, ...paths.flat()])].filter(t => t.length <= 40),
    lifespan: 'persistent', recall: ids.includes('novice') ? 'none' : (role?.recall || 'project'),
    composition: { version: '1', archetype_ids: ids, specialty_paths: paths, evidence_ids: evidence.map(e => e.id) },
    notes: `Composed professional hypothesis. Confidence numbers are conservative author settings, not measured probabilities. Uncovered specialties: ${gaps.join(', ') || 'none requested or matched by reviewed principles; no expertise validation implied'}.`.slice(0, 2000),
  });
  return { persona, principles: selected, evidence_gaps: gaps,
    evidence_status: 'Reviewed source interpretations; synthetic persona and specialty application remain hypotheses.',
    reminder: 'hypothesis, not validation' };
}

export function planConsultation(task, { specialties = [], archetypes = [], count = 5, mode = 'consultant', artifact, project } = {}) {
  if (typeof task !== 'string' || !task.trim()) throw new Error('Consultation requires a task');
  if (task.length > 400) throw new Error('Consultation task must be at most 400 characters');
  if (!Number.isInteger(count) || count < 3 || count > 8) throw new Error('Consultant count must be an integer from 3 to 8');
  if (!['consultant', 'ui-ux'].includes(mode)) throw new Error('Mode must be consultant or ui-ux');
  const explicitPaths = parseSpecialties(specialties);
  const paths = explicitPaths.length ? explicitPaths : inferSpecialties(task);
  const explicit = [...new Set(Array.isArray(archetypes) ? archetypes : String(archetypes).split(',').filter(Boolean))];
  explicit.forEach(findArchetype);
  if (explicit.filter(id => id !== 'red-team').length > count - 1) throw new Error('Increase --count to include all requested archetypes plus red-team');
  const text = task.toLowerCase();
  const scores = ARCHETYPE_CATALOG.archetypes.filter(a => a.id !== 'red-team').map((a, index) => {
    const terms = a.keywords.filter(k => phrasePresent(text, k));
    return { archetype: a, terms, index, score: terms.length * 10 +
      (mode === 'ui-ux' && ['designer', 'researcher', 'engineer', 'accessibility'].includes(a.id) ? 40 : 0) +
      (a.default ? 1 : 0) };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [...new Set([...explicit.filter(id => id !== 'red-team'), ...scores.map(s => s.archetype.id)])].slice(0, count - 1);
  selected.push('red-team');
  const saved = listPersonas().filter(p => p.status !== 'archived');
  const assignedIds = new Set();
  const assignments = selected.map(id => {
    const base = findArchetype(id);
    // Reuse only a matching composition, never silently promote a generic saved persona.
    const match = saved.find(p => !assignedIds.has(p.id) && p.composition?.archetype_ids.includes(id) &&
      paths.every(wanted => p.composition.specialty_paths.some(have => have.join('/') === wanted.join('/'))));
    if (match) assignedIds.add(match.id);
    const composed = match ? null : composePersona({ archetypes: [id], specialties: paths, task });
    const attached = match ? reviewedPrinciples().filter(e => match.evidence.some(savedEvidence =>
      savedEvidence.id === evidenceId(e.id) && savedEvidence.title === e.id &&
      match.composition.evidence_ids.includes(savedEvidence.id) &&
      savedEvidence.source_uri === evidenceUri(e))) : composed.principles;
    const recallContext = match?.recall === 'project' ? ['project'] : match?.recall === 'artifact' ? ['artifact'] : [];
    const missingRecall = recallContext.filter(key => !(key === 'project' ? project : artifact));
    return { archetype_id: id, review_lens: base.lens, name: match?.name || composed.persona.name,
      selection_reason: id === 'red-team' ? 'Challenge the proposed solution and evidence gaps.' :
        `Responsibility: ${base.goal} Matched terms: ${scores.find(s => s.archetype.id === id)?.terms.join(', ') || 'task coverage default'}.`,
      source: match ? 'saved-library' : 'composed-draft', persona_id: match?.id || null,
      persona: composed?.persona || match,
      principles: attached,
      evidence_gaps: paths.filter(p => !attached.some(e => matchesSpecialty(e, p))).map(p => p.join('/')),
      recall_context_required: missingRecall,
      recall_command: match && !missingRecall.length ? ['persona', 'recall', match.id,
        ...(artifact ? ['--artifact', artifact] : []), ...(project ? ['--project', project] : []), '--json'] : null,
      deliverable: 'Independent observations, alternatives, supporting sources, failure cases and unresolved questions.',
    };
  });
  return { version: '1', task, mode, execution: 'plan-only',
    specialty_selection: { source: explicitPaths.length ? 'explicit' : 'keyword-candidates', paths },
    taxonomy_policy: 'Overlapping expertise and open specialty paths; no exclusive categorization.',
    assignments, unanswered: ['What artifact and version should be examined?', 'What decision, constraints and evidence define success?'],
    launch_steps: [
      'Confirm task context and review each selection and evidence gap.',
      'Save new draft personas with persona save before recording a run; do not invent completed encounters.',
      'Read permitted recall for saved personas with artifact/project scope when applicable.',
      'Freeze the artifact and open a persona run, or use the separate council API contract.',
      'Dispatch independent perspectives before sharing reactions; attach evidence and preserve dissent.',
      'Synthesize a recommendation and next verification steps.'],
    reminder: 'hypothesis, not validation' };
}
