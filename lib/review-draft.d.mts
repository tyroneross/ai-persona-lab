export type ReviewDraft = { version: number; presetId: string; mode: 'single' | 'panel'; artifact: string; decision: string; constraints: string; selected: string[] };
export function emptyReviewDraft(): ReviewDraft;
export function parseReviewDraft(raw: string | null): ReviewDraft;
