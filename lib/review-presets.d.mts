export type ReviewLens = { role: string; name: string; recall: 'none' | 'artifact' | 'project' | 'all'; focus: string };
export type ReviewPreset = { id: string; version: number; title: string; subtitle: string; question: string; evidence: string; lenses: ReviewLens[] };
export type ReviewReference = { id: string; name: string; provenance?: string; recall?: string };
export const REVIEW_PRESETS: ReviewPreset[];
export function buildReviewBrief(preset: ReviewPreset, input: { artifact: string; decision: string; constraints?: string; mode?: "single" | "panel"; personas?: ReviewReference[] }): string;
