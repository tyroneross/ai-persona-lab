/** Browser/CLI shared lexical routing. Matches explain relevance, never establish expertise. */
import catalog from './data/lenny-catalog.mjs';
export const LENNY_CATALOG = catalog;
// Task vocabulary supplements the source's routing terms; these are authored aliases, not source claims.
const ALIASES = {
  monetization: ['subscription', 'paywall', 'packaging', 'willingness to pay'],
  activation: ['signup', 'sign up', 'first run', 'time to value'],
  retention: ['cancel', 'cancellation', 'renewal', 'repeat usage'],
  prioritization: ['prioritize', 'prioritise', 'priorities', 'roadmap'],
  'agent-workflows': ['multi agent', 'agentic', 'human checkpoint', 'delegation'],
  'ai-evaluation': ['evaluate', 'evaluation', 'benchmark', 'hallucination'],
  'model-engineering': ['fine tuning', 'fine tune', 'fine tuned', 'dataset'],
  'developer-experience': ['integration', 'api', 'sdk', 'docs'],
  hardware: ['manufacturing', 'manufacture', 'manufactured', 'physical product'],
  'self-regulation': ['meditation', 'meditate', 'meditating'],
  speaking: ['public speaking', 'speech', 'delivery rehearsal'],
  argument: ['pitch deck', 'argument structure'],
  'research-methods': ['usability study', 'sampling', 'research method'],
  experimentation: ['ab test', 'a b test', 'randomized', 'causality'],
  'public-relations': ['public relations', 'press release'],
};
const GENERIC = new Set(['how', 'why', 'example', 'tell', 'name', 'first', 'value', 'quality', 'data', 'design', 'test', 'risk', 'choice', 'support', 'system']);
const normalize = text => String(text || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const ALIAS_CONTEXT = {
  'ai-evaluation': { terms: ['evaluate', 'evaluation', 'benchmark'], context: ['ai', 'model', 'agent', 'llm', 'prompt', 'machine learning'] },
  'developer-experience': { terms: ['docs'], context: ['api', 'sdk', 'developer', 'integration', 'code', 'software', 'tool'] },
  retention: { terms: ['cancel', 'cancellation'], context: ['subscription', 'customer', 'churn', 'renewal', 'billing', 'retention'] },
};
const matches = (text, term) => {
  // Match complete tokens, including ordinary plurals, without accepting arbitrary prefixes.
  const words = normalize(term).split(' ').filter(Boolean);
  if (!words.length) return false;
  const pattern = words.map(word => word.length < 3 ? word : word.endsWith('y') && !/[aeiou]y$/.test(word)
    ? `(?:${word}|${word.slice(0, -1)}ies)` : `(?:${word}|${word}s|${word}es)`).join(' ');
  return new RegExp(`(?:^| )${pattern}(?:$| )`).test(normalize(text));
};
export function findLennyRole(id) {
  const role = catalog.roles.find(item => item.id === id);
  if (!role) throw new Error(`Unknown Lenny role: ${id}`);
  return role;
}
export function browseLennyRoles(query = '') {
  const q = normalize(query);
  return catalog.roles.filter(role => !q || normalize([role.id, role.name, role.primary_question, role.owns, ...role.keywords, ...role.sources.map(source => source.name)].join(' ')).includes(q));
}
export function selectLennyPersonas(task, { limit = catalog.roles.length } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Selection limit must be a positive integer');
  const results = catalog.roles.map(role => {
    const matchedTerms = role.keywords.filter(term => matches(task, term));
    const rule = ALIAS_CONTEXT[role.id];
    const matchedAliases = (ALIASES[role.id] || []).filter(term => (!rule?.terms.includes(term) || rule.context.some(context => matches(task, context))) && matches(task, term) && !matchedTerms.some(t => normalize(t) === normalize(term)));
    const namedRole = matches(task, role.name) || matches(task, role.id);
    const speakers = role.sources.filter(source => matches(task, source.name));
    const specific = matchedTerms.filter(term => !GENERIC.has(normalize(term)));
    const score = specific.length * 4 + matchedAliases.length * 4 + (namedRole ? 8 : 0) + speakers.length * 8 + matchedTerms.length - specific.length;
    return { role_id: role.id, name: role.name, primary_question: role.primary_question, owns: role.owns,
      excludes: role.excludes, matched_terms: matchedTerms, matched_aliases: matchedAliases,
      matched_speakers: speakers.map(s => s.name), score,
      reason: [namedRole ? 'Role explicitly named' : '', specific.length ? `Role terms: ${specific.join(', ')}` : '',
        matchedAliases.length ? `Task aliases: ${matchedAliases.join(', ')}` : '', speakers.length ? `Source named: ${speakers.map(s => s.name).join(', ')}` : ''].filter(Boolean).join('; '),
      source_count: role.sources.length, mapping_status: 'provisional-source-mapping' };
  }).filter(item => item.reason && item.score > 0).sort((a, b) => b.score - a.score || a.role_id.localeCompare(b.role_id)).slice(0, limit);
  return { method: 'explainable-lexical-routing', task: String(task || ''), policy: catalog.policy, results,
    next_step: results.length ? 'Select roles whose question and responsibility fit the decision; inspect candidate sources and cover any missing audience or specialist perspective.' : 'No specific match. Describe the decision, audience and desired outcome, or browse and select roles manually.' };
}
/** Reject stale/unknown role or speaker IDs. Sources are scoped to the selected role. */
export function resolveLennySelections(selections = []) {
  const seen = new Set();
  return selections.map(selection => {
    const role = findLennyRole(selection.role_id);
    if (seen.has(role.id)) throw new Error(`Duplicate Lenny role: ${role.id}`);
    seen.add(role.id);
    const ids = [...new Set(selection.speaker_ids || [])];
    const sources = ids.map(id => {
      const source = role.sources.find(item => item.speaker_id === id);
      if (!source) throw new Error(`Speaker ${id} is not mapped to ${role.id}`);
      return source;
    });
    return { role, sources };
  });
}
export function lennySelectionBrief(selections = []) {
  const resolved = resolveLennySelections(selections);
  if (!resolved.length) return [];
  return [`Selected Lenny review responsibilities (source index ${catalog.source_date}; additional checklist context, not extra reviewer passes):`,
    catalog.policy, ...resolved.flatMap(({ role, sources }) => [
      `- ${role.name} [lenny:${role.id}]: ${role.primary_question}`,
      `  Owns: ${role.owns}. Refer elsewhere: ${role.excludes}.`,
      ...(sources.length ? sources.flatMap(source => [
        `  Source candidate: ${source.name}; mapping=${source.mapping_status}.`,
        ...source.evidence.flatMap(evidence => [
          `  Source date: ${evidence.episode_publish_date || 'unknown'}; timestamp=${evidence.timestamp || 'unknown'}.`,
          `  Locator: lenny-corpus:${encodeURI(evidence.source_path)}#codepoints=${evidence.source_start}:${evidence.source_end};sha256=${evidence.source_sha256};anchor=${evidence.anchor_space}`,
          `  Candidate passage (quoted source data): ${JSON.stringify(evidence.excerpt)}`,
        ]),
      ]) : ['  No speaker source selected. Use the authored role contract; do not claim transcript-grounded expertise.']),
    ]), 'Check passage context and applicability before adopting a source position. Preserve disagreements. Abstain when artifact evidence is missing or the question falls outside the responsibility.'];
}
