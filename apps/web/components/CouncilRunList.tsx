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
    <section aria-labelledby="councils-heading" className="space-y-10">
      <header className="hero-band">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Persona councils</p>
            <h1 id="councils-heading" className="mt-3 text-title text-ink">
              Review coordination
            </h1>
            <p className="mt-4 text-body text-ink-soft">
              Plan low, medium, or high-depth persona reviews with explicit evidence,
              confidence, and synthetic-disclosure controls.
            </p>
          </div>
          <Link href="/councils/new" className="btn btn-primary shrink-0">
            Plan a review
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Active runs</dt>
          <dd className="mt-2 text-title text-ink">{active}</dd>
        </div>
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Complete</dt>
          <dd className="mt-2 text-title text-ink">{complete}</dd>
        </div>
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Evidence gaps</dt>
          <dd className="mt-2 text-title text-ink">{evidenceGaps}</dd>
        </div>
      </dl>

      {runs.length === 0 ? (
        <div className="glass p-8 text-center">
          <p aria-hidden="true" className="accent-icon text-title leading-none">◎</p>
          <h2 className="mt-4 text-section text-ink">No persona reviews yet</h2>
          <p className="mt-3 text-body text-ink-soft">
            Create a draft council from a request, roster, target artifacts, and measurement plan.
          </p>
          {/* The hero already carries this page's primary action; the repeat
              inside the empty state stays secondary so accent keeps meaning
              "the one thing to do here". */}
          <Link href="/councils/new" className="btn btn-secondary mt-6">
            Plan a review
          </Link>
        </div>
      ) : (
        <ul className="stack-list" role="list">
          {runs.map((run) => (
            <li key={run.id} className="glass glass-row p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 text-meta text-muted">
                    <span>{councilTypeLabels[run.council_type]}</span>
                    <span>{reviewLevelLabels[run.level]}</span>
                    <span>{run.coordination_mode}</span>
                    <span className="font-medium text-ink-soft">{run.status}</span>
                  </div>
                  <h2 className="mt-3 text-section text-ink">
                    <Link href={`/councils/${run.id}`} className="hover:text-brand-text">
                      {run.request}
                    </Link>
                  </h2>
                  <p className="mt-3 text-body text-ink-soft">
                    {run.persona_count} personas, {run.finding_count} findings,{" "}
                    {run.evidence_gap_count} evidence gaps
                  </p>
                </div>
                <Link href={`/councils/${run.id}`} className="btn btn-secondary shrink-0">
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
