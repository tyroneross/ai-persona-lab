import Link from "next/link";
import PersonaCard from "@components/PersonaCard";
import { filePersonaRepository } from "@lib/persona-repository.server";
import type { PersonaSummary } from "@lib/persona";

export const dynamic = "force-dynamic";

type ResearchLane = {
  title: string;
  description: string;
  signal: string;
};

const researchLanes: ResearchLane[] = [
  {
    title: "Battlecard gaps",
    description: "Competitor claims that need fresher evidence before enablement.",
    signal: "positioning",
  },
  {
    title: "Switching triggers",
    description: "Moments that explain why buyers prefer a competitor.",
    signal: "win-loss",
  },
  {
    title: "Field objections",
    description: "Active deal concerns that need approved proof or follow-up.",
    signal: "objections",
  },
];

function averageConfidence(personas: PersonaSummary[]): number {
  if (personas.length === 0) return 0;
  const total = personas.reduce((sum, p) => sum + p.confidence, 0);
  return Math.round((total / personas.length) * 100);
}

function countByStatus(personas: PersonaSummary[], status: PersonaSummary["status"]) {
  return personas.filter((persona) => persona.status === status).length;
}

export default async function CompetitiveResearchPage() {
  const personas = await filePersonaRepository.listPersonas({
    tags: ["competitive-research"],
  });
  const activeCount = countByStatus(personas, "active");
  const draftCount = countByStatus(personas, "draft");
  const avgConfidence = averageConfidence(personas);
  const draftEvidenceLabel =
    draftCount === 1
      ? "1 draft persona needs"
      : `${draftCount} draft personas need`;

  return (
    <section aria-labelledby="competitive-research-heading" className="space-y-10">
      <header className="hero-band">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">
              Competitive research
            </p>
            <h1
              id="competitive-research-heading"
              className="mt-3 text-title text-ink"
            >
              Persona-backed competitor workbench
            </h1>
            <p className="mt-4 text-body text-ink-soft">
              Track the internal users who turn competitor signals into
              battlecards, switching narratives, and field-ready objection
              handling.
            </p>
          </div>
          <Link
            href="/personas/new"
            className="btn btn-primary shrink-0"
          >
            Create persona
          </Link>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Research personas</dt>
          <dd className="mt-2 text-title text-ink">{personas.length}</dd>
        </div>
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Active</dt>
          <dd className="mt-2 text-title text-ink">{activeCount}</dd>
        </div>
        <div className="glass p-5">
          <dt className="text-meta font-medium text-muted">Avg confidence</dt>
          <dd className="mt-2 text-title text-ink">{avgConfidence}%</dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section aria-labelledby="research-personas-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="research-personas-heading"
                className="text-section text-ink"
              >
                Competitive research personas
              </h2>
              <p className="mt-2 text-body text-muted">
                {draftEvidenceLabel} more evidence.
              </p>
            </div>
            <Link
              href="/"
              className="quiet-action text-body font-medium text-brand-text"
            >
              View all personas
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2" role="list">
            {personas.map((persona) => (
              <li key={persona.id}>
                <PersonaCard persona={persona} />
              </li>
            ))}
          </ul>
        </section>

        <aside aria-labelledby="research-lanes-heading">
          <h2 id="research-lanes-heading" className="text-section text-ink">
            Research lanes
          </h2>
          <ul className="stack-list glass mt-5 p-5" role="list">
            {researchLanes.map((lane) => (
              <li key={lane.title}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-body font-semibold text-ink">{lane.title}</h3>
                  <span className="text-meta text-muted">{lane.signal}</span>
                </div>
                <p className="mt-2 text-body text-ink-soft">
                  {lane.description}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
