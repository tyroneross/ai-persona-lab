import type { CommandPacket, PersonaReviewBundle, PromptVersion, ReviewRunStatus } from "@lib/council";
import { councilTypeLabels, reviewLevelLabels, statusTransitions } from "@lib/council";
import { exportCouncilPackage, exportRunMarkdown } from "@lib/council-export";
import { comparePromptVersions } from "@lib/prompt-comparison";
import { refreshOutcomeComparisonAction, updateCouncilRunStatusAction } from "@/app/councils/actions";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function WarningBlock({ bundle }: { bundle: PersonaReviewBundle }) {
  const syntheticFindings = bundle.findings.filter((finding) => finding.behavior_source !== "real_users");
  const evidenceGaps = [
    ...(bundle.synthesis?.evidence_gaps ?? []),
    ...bundle.assignments.flatMap((assignment) => assignment.evidence_gaps),
  ];

  if (syntheticFindings.length === 0 && evidenceGaps.length === 0) return null;

  return (
    <section className="rounded-md border border-warn bg-warn-soft p-4" aria-labelledby="trust-warning">
      <h2 id="trust-warning" className="text-sm font-semibold text-ink">
        Trust warning
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        This run includes synthetic or mixed-evidence findings, unresolved evidence gaps,
        or both. Treat the review as decision support, not proof of real-user behavior.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted">Synthetic or mixed findings</dt>
          <dd className="text-lg font-semibold text-ink">{syntheticFindings.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted">Evidence gaps</dt>
          <dd className="text-lg font-semibold text-ink">{evidenceGaps.length}</dd>
        </div>
      </dl>
    </section>
  );
}

function StatusActions({
  runId,
  status,
  updatedAt,
}: {
  runId: string;
  status: ReviewRunStatus;
  updatedAt: string;
}) {
  const nextStatuses = statusTransitions[status];
  if (nextStatuses.length === 0) return null;
  return (
    <form action={updateCouncilRunStatusAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="run_id" value={runId} />
      <input type="hidden" name="updated_at" value={updatedAt} />
      {nextStatuses.map((next) => (
        <button
          key={next}
          type="submit"
          name="status"
          value={next}
          className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-line-strong"
        >
          Mark {next}
        </button>
      ))}
    </form>
  );
}

function CommandPacketView({ packet }: { packet: CommandPacket }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="command-packet">
      <h2 id="command-packet" className="text-lg font-semibold text-ink">
        Dry-run command packet
      </h2>
      {packet.warnings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {packet.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-canvas p-4 text-xs leading-6 text-ink">
        {packet.commands.join("\n")}
      </pre>
    </section>
  );
}

export default function CouncilRunDetail({
  bundle,
  packet,
  prompts,
}: {
  bundle: PersonaReviewBundle;
  packet: CommandPacket;
  prompts: PromptVersion[];
}) {
  const markdown = exportRunMarkdown(bundle);
  const councilPackage = exportCouncilPackage(bundle);

  return (
    <article className="space-y-8">
      <header className="border-b border-line pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase text-muted">Persona review</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{bundle.run.request}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
              <span>{councilTypeLabels[bundle.run.council_type]}</span>
              <span>{reviewLevelLabels[bundle.run.level]}</span>
              <span>{bundle.run.status}</span>
              <span>{bundle.run.coordination_mode}</span>
            </div>
          </div>
          <StatusActions
            runId={bundle.run.id}
            status={bundle.run.status}
            updatedAt={bundle.run.updated_at}
          />
        </div>
      </header>

      <WarningBlock bundle={bundle} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Personas / passes</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">
            {new Set(bundle.assignments.map((a) => a.persona_id)).size}
            <span className="text-base font-normal text-muted"> / {bundle.assignments.length}</span>
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Findings</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">{bundle.findings.length}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Sources</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">
            {bundle.findings.reduce((sum, finding) => sum + finding.source_uris.length, 0)}
          </dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Events</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">{bundle.events.length}</dd>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="measurement-plan">
        <h2 id="measurement-plan" className="text-lg font-semibold text-ink">
          Measurement plan
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted">Decision supported</dt>
            <dd className="mt-1 text-sm text-ink-soft">{bundle.measurement_plan.decision_supported}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Target artifact</dt>
            <dd className="mt-1 text-sm text-ink-soft">{bundle.measurement_plan.target_artifact}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Confidence policy</dt>
            <dd className="mt-1 text-sm text-ink-soft">{bundle.measurement_plan.confidence_policy}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Synthetic policy</dt>
            <dd className="mt-1 text-sm text-ink-soft">{bundle.measurement_plan.synthetic_policy}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="assignments">
        <h2 id="assignments" className="text-lg font-semibold text-ink">
          Assignments
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Persona</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bundle.assignments.map((assignment) => {
                const persona = bundle.roster.personas.find((item) => item.id === assignment.persona_id);
                return (
                  <tr key={assignment.id}>
                    <td className="py-3 pr-4 text-ink">{persona?.name ?? assignment.persona_id}</td>
                    <td className="py-3 pr-4 text-ink-soft">{assignment.status}</td>
                    <td className="py-3 pr-4 text-ink-soft">{assignment.model_tier}</td>
                    <td className="py-3 pr-4 text-ink-soft">{assignment.output_path ?? "Pending"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="findings">
        <h2 id="findings" className="text-lg font-semibold text-ink">
          Findings
        </h2>
        <ul className="mt-4 space-y-4">
          {bundle.findings.map((finding) => (
            <li key={finding.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{finding.severity}</span>
                <span>{finding.behavior_source}</span>
                <span>evidence {percent(finding.evidence_confidence)}</span>
                <span>synthesis {percent(finding.synthesis_confidence)}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">{finding.claim}</p>
              <p className="mt-1 text-sm text-ink-soft">{finding.recommended_action}</p>
              {finding.source_uris.length > 0 && (
                <p className="mt-2 text-xs text-muted">Sources: {finding.source_uris.join(", ")}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {bundle.synthesis && (
        <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="synthesis">
          <h2 id="synthesis" className="text-lg font-semibold text-ink">
            Synthesis
          </h2>
          <p className="mt-2 text-sm text-ink-soft">{bundle.synthesis.decision_recommendation}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Top findings</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {bundle.synthesis.top_findings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Dissent and gaps</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {[...bundle.synthesis.dissent_map, ...bundle.synthesis.evidence_gaps].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="comparison">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 id="comparison" className="text-lg font-semibold text-ink">
              Prompt and package comparison
            </h2>
            <p className="mt-2 text-sm text-ink-soft">{comparePromptVersions(prompts)}</p>
            {bundle.outcome_comparison && (
              <p className="mt-2 text-sm text-ink-soft">{bundle.outcome_comparison.actionability_notes}</p>
            )}
          </div>
          <form action={refreshOutcomeComparisonAction}>
            <input type="hidden" name="run_id" value={bundle.run.id} />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-line-strong"
            >
              Refresh comparison
            </button>
          </form>
        </div>
      </section>

      <CommandPacketView packet={packet} />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">Markdown export</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-md border border-line bg-canvas p-4 text-xs leading-6 text-ink">
            {markdown}
          </pre>
        </div>
        <div className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">Agent Builder-style package</h2>
          <pre className="mt-4 max-h-80 overflow-auto rounded-md border border-line bg-canvas p-4 text-xs leading-6 text-ink">
            {councilPackage}
          </pre>
        </div>
      </section>
    </article>
  );
}
