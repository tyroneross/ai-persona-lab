import { resolveLennySelections } from './lenny-catalog.mjs';
/** Tab-local recovery is versioned and treats stored values as untrusted input. */
export const emptyReviewDraft = () => ({ version: 1, presetId: 'handoff', mode: 'single', artifact: '', decision: '', constraints: '', selected: [], lennySelections: [] });
export function parseReviewDraft(raw) {
  const fallback = emptyReviewDraft();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1) return fallback;
    const lennySelections = [];
    for (const entry of Array.isArray(value.lennySelections) ? value.lennySelections : []) {
      try {
        if (!entry || typeof entry.role_id !== 'string' || !Array.isArray(entry.speaker_ids) || !entry.speaker_ids.every(id => typeof id === 'string')) continue;
        const [resolved] = resolveLennySelections([entry]);
        if (!lennySelections.some(item => item.role_id === resolved.role.id)) lennySelections.push({ role_id: resolved.role.id, speaker_ids: resolved.sources.map(source => source.speaker_id) });
      } catch { /* Catalog revisions may invalidate one choice; keep the remaining draft. */ }
    }
    return {
      ...fallback,
      lennySelections,
      presetId: ['handoff', 'interface', 'decision'].includes(value.presetId) ? value.presetId : fallback.presetId,
      mode: value.mode === 'panel' ? 'panel' : 'single',
      ...Object.fromEntries(['artifact', 'decision', 'constraints'].map(key => [key, typeof value[key] === 'string' ? value[key] : ''])),
      selected: Array.isArray(value.selected) ? [...new Set(value.selected.filter(id => typeof id === 'string'))] : [],
    };
  } catch { return fallback; }
}
