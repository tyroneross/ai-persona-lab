import Link from "next/link";
import type { PersonaReviewRunSummary } from "@lib/council";
import { councilTypeLabels, reviewLevelLabels } from "@lib/council";

function countByStatus(runs: PersonaReviewRunSummary[], status: PersonaReviewRunSummary["status"]) {
  return runs.filter((run) => run.status === status).length;
}

export default function CouncilRunList({ runs }: { runs: PersonaReviewRunSummary[] }) {
  const complete = countByStatus(runs, "complete");
  const active = runs.filter((run) => !["complete", "archived"].includes(run.status)).length;
  const evidenceGaps = runs.reduce((sum, run) => sum + run.evidence_gap_count, 0);

  return (
    <section aria-labelledby="councils-heading" className="space-y-8">
      <header className="border-b border-line pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase text-muted">Persona councils</p>
            <h1 id="councils-heading" className="mt-2 text-3xl font-semibold text-ink">
              Review coordination
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Plan low, medium, or high-depth persona reviews with explicit evidence,
              confidence, and synthetic-disclosure controls.
            </p>
          </div>
          <Link
            href="/councils/new"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-soft"
          >
            Plan a review
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Active runs</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">{active}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Complete</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">{complete}</dd>
        </div>
        <div className="rounded-md border border-line bg-surface p-4">
          <dt className="text-xs font-medium text-muted">Evidence gaps</dt>
          <dd className="mt-2 text-2xl font-semibold text-ink">{evidenceGaps}</dd>
        </div>
      </dl>

      {runs.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-strong bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">No persona reviews yet</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Create a draft council from a request, roster, target artifacts, and measurement plan.
          </p>
          <Link
            href="/councils/new"
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-white"
          >
            Plan a review
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4" role="list">
          {runs.map((run) => (
            <li key={run.id} className="rounded-md border border-line bg-surface p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{councilTypeLabels[run.council_type]}</span>
                    <span>{reviewLevelLabels[run.level]}</span>
                    <span>{run.coordination_mode}</span>
                    <span>{run.status}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-ink">
                    <Link href={`/councils/${run.id}`} className="hover:text-accent-strong">
                      {run.request}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm text-ink-soft">
                    {run.persona_count} personas, {run.finding_count} findings,{" "}
                    {run.evidence_gap_count} evidence gaps
                  </p>
                </div>
                <Link
                  href={`/councils/${run.id}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-line-strong"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
