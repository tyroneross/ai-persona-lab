import type { PersonaReviewBundle } from "./council";
import { councilTypeLabels, reviewLevelLabels } from "./council";

export function exportRunMarkdown(bundle: PersonaReviewBundle): string {
  const findingRows = bundle.findings
    .map(
      (finding) =>
        `| ${finding.severity} | ${finding.claim} | ${Math.round(
          finding.evidence_confidence * 100,
        )}% / ${Math.round(finding.synthesis_confidence * 100)}% | ${finding.recommended_action} |`,
    )
    .join("\n");
  const topFindings = bundle.synthesis?.top_findings.map((item) => `- ${item}`).join("\n") || "- No synthesis yet.";
  const evidenceGaps =
    bundle.synthesis?.evidence_gaps.map((item) => `- ${item}`).join("\n") || "- No evidence gaps recorded.";

  return `# Persona Review: ${bundle.run.request}

## Run

- Type: ${councilTypeLabels[bundle.run.council_type]}
- Level: ${reviewLevelLabels[bundle.run.level]}
- Status: ${bundle.run.status}
- Coordination: ${bundle.run.coordination_mode}
- Personas: ${bundle.run.persona_ids.length}

## Measurement Plan

- Decision supported: ${bundle.measurement_plan.decision_supported}
- Target artifact: ${bundle.measurement_plan.target_artifact}
- Confidence policy: ${bundle.measurement_plan.confidence_policy}
- Synthetic policy: ${bundle.measurement_plan.synthetic_policy}

## Top Findings

${topFindings}

## Evidence Gaps

${evidenceGaps}

## Findings

| Severity | Claim | Evidence / synthesis confidence | Recommended action |
| --- | --- | --- | --- |
${findingRows || "| - | No findings yet | - | - |"}
`;
}

export function exportCouncilPackage(bundle: PersonaReviewBundle): string {
  return JSON.stringify(
    {
      schema_version: "1.0.0",
      package_type: "persona_council_export",
      run: bundle.run,
      roster: bundle.roster,
      measurement_plan: bundle.measurement_plan,
      assignments: bundle.assignments,
      findings: bundle.findings,
      synthesis: bundle.synthesis,
      setup_checks: [
        "Review synthetic disclosure before reuse.",
        "Confirm target artifacts still exist.",
        "Refresh source URIs before high-stakes decisions.",
      ],
      eval_notes: bundle.outcome_comparison,
    },
    null,
    2,
  );
}
