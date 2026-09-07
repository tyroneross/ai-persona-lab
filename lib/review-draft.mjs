/** Tab-local recovery is versioned and treats stored values as untrusted input. */
export const emptyReviewDraft = () => ({ version: 1, presetId: 'handoff', mode: 'single', artifact: '', decision: '', constraints: '', selected: [] });
export function parseReviewDraft(raw) {
  const fallback = emptyReviewDraft();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1) return fallback;
    return {
      ...fallback,
      presetId: ['handoff', 'interface', 'decision'].includes(value.presetId) ? value.presetId : fallback.presetId,
      mode: value.mode === 'panel' ? 'panel' : 'single',
      ...Object.fromEntries(['artifact', 'decision', 'constraints'].map(key => [key, typeof value[key] === 'string' ? value[key] : ''])),
      selected: Array.isArray(value.selected) ? [...new Set(value.selected.filter(id => typeof id === 'string'))] : [],
    };
  } catch { return fallback; }
}
