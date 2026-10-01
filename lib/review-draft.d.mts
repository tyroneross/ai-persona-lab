import type { LennySelection } from './lenny-catalog.mjs';
export type ReviewDraft = { version: number; presetId: string; mode: 'single' | 'panel'; artifact: string; decision: string; constraints: string; selected: string[]; lennySelections: LennySelection[] };
export function emptyReviewDraft(): ReviewDraft;
export function parseReviewDraft(raw: string | null): ReviewDraft;
