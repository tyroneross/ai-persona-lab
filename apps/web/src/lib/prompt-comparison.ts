import type { OutcomeComparison, PersonaReviewBundle, PromptVersion } from "./council";

function averageScore(prompt: PromptVersion): number {
  if (!prompt.score) return 0;
  const values = Object.values(prompt.score);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function comparePromptVersions(prompts: PromptVersion[]): string {
  const native = prompts.find((prompt) => prompt.source === "native");
  const builder = prompts.find((prompt) => prompt.source === "prompt_builder");
  if (!native || !builder) {
    return "Prompt comparison is not complete yet.";
  }
  const delta = Math.round((averageScore(builder) - averageScore(native)) * 100);
  return `Prompt Builder variant is ${delta >= 0 ? "+" : ""}${delta} points versus native baseline on average prompt-quality score.`;
}

export function buildOutcomeComparison(bundle: PersonaReviewBundle, prompts: PromptVersion[]): OutcomeComparison {
  const now = new Date().toISOString();
  return {
    schema_version: "1.0.0",
    id: `outcome_${bundle.run.id}`,
    run_id: bundle.run.id,
    prompt_builder_run_id: prompts.find((prompt) => prompt.source === "prompt_builder")?.id,
    coverage_notes: `${bundle.findings.length} findings across ${bundle.assignments.length} assignments.`,
    evidence_quality_notes:
      bundle.findings.length === 0
        ? "No findings have landed yet."
        : "Findings track source URIs or explicit assumptions plus evidence and synthesis confidence.",
    actionability_notes:
      bundle.synthesis?.recommended_next_actions.join("; ") || "No recommended next actions have been synthesized yet.",
    cost_time_notes: "Cost and runtime are local estimates until live launch adapters record execution metrics.",
    reuse_notes: comparePromptVersions(prompts),
    created_at: bundle.outcome_comparison?.created_at ?? now,
    updated_at: now,
  };
}
