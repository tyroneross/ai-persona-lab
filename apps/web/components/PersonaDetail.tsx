import Link from "next/link";
import type { EvidenceItem, Persona } from "@lib/persona";
import { confidenceLabel, formatDate } from "@lib/format";
import ConfidenceMeter from "./ConfidenceMeter";
import StatusPill from "./StatusPill";

const PROVENANCE_LABEL: Record<string, string> = {
  proto: "proto — team assumptions",
  qualitative: "qualitative — real research",
  "synthetic-grounded": "synthetic, grounded in data",
  "synthetic-assumed": "synthetic — hypothesis, not validated",
};

function ProvenanceBadge({ provenance }: { provenance: string }) {
  const hypothesis = provenance.startsWith("synthetic");
  return (
    <span
      className={`text-meta font-medium ${hypothesis ? "text-warn" : "text-muted"}`}
      title="Basis for this persona"
    >
      {PROVENANCE_LABEL[provenance] ?? provenance}
    </span>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="section-label">
        {title}
      </h2>
      <ul className="mt-3 space-y-2 text-body text-ink-soft" role="list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

// Evidence rows separate by whitespace; synthetic sources are marked with text
// colour only, never a filled badge or a tinted panel.
function EvidenceRow({ e }: { e: EvidenceItem }) {
  const isSynthetic = e.source_type === "synthetic";
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body font-semibold text-ink">{e.title ?? "Untitled source"}</p>
        <span
          className={`text-meta font-semibold uppercase tracking-wide ${
            isSynthetic ? "text-warn" : "text-muted"
          }`}
        >
          {e.source_type}
        </span>
      </div>
      <p className="text-body text-ink-soft mt-2">{e.summary}</p>
      {e.quote && (
        <blockquote className="mt-3 border-l-2 border-brand pl-4 text-body italic text-ink-soft">
          {e.quote}
        </blockquote>
      )}
      <div className="mt-3">
        <ConfidenceMeter value={e.confidence} size="sm" />
      </div>
    </li>
  );
}

export default function PersonaDetail({ persona }: { persona: Persona }) {
  const conf = confidenceLabel(persona.confidence);
  return (
    <article className="space-y-12" aria-labelledby="persona-name">
      <header className="hero-band">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-meta text-muted flex-wrap">
              <StatusPill status={persona.status} />
              <span aria-hidden>·</span>
              <span>updated {formatDate(persona.updated_at)}</span>
              {persona.provenance && (
                <>
                  <span aria-hidden>·</span>
                  <ProvenanceBadge provenance={persona.provenance} />
                </>
              )}
            </div>
            <h1 id="persona-name" className="text-title text-ink mt-3 break-words">
              {persona.name}
            </h1>
            <p className="text-body text-muted mt-2">
              {persona.archetype} <span aria-hidden>·</span> {persona.role}
            </p>
          </div>
          <Link
            href={`/personas/${persona.id}/edit`}
            className="btn btn-primary shrink-0"
          >
            Edit
          </Link>
        </div>
        {persona.quote && (
          <blockquote className="mt-6 border-l-2 border-brand pl-4 italic text-ink-soft">
            “{persona.quote}”
          </blockquote>
        )}
        <p className="mt-6 text-body text-ink-soft max-w-2xl">{persona.summary}</p>
        <div className="mt-5 flex items-center gap-3" aria-label={conf.label}>
          <ConfidenceMeter value={persona.confidence} showLabel={false} />
          <span className="text-meta text-muted">{conf.label}</span>
        </div>
      </header>

      <section>
        <h2 className="section-label">
          Primary goal
        </h2>
        <p className="mt-3 text-section text-ink">{persona.primary_goal}</p>
        {persona.job_to_be_done && (
          <p className="mt-4 text-body text-ink-soft max-w-2xl">
            <span className="font-medium text-muted">Job to be done: </span>
            {persona.job_to_be_done}
          </p>
        )}
      </section>

      <div className="glass-sunken grid grid-cols-1 gap-x-10 gap-y-10 p-6 md:grid-cols-2 sm:p-8">
        <Section title="Goals" items={persona.goals} />
        <Section title="Frustrations" items={persona.frustrations} />
        <Section title="Motivations" items={persona.motivations} />
        <Section title="Behaviors" items={persona.behaviors} />
        <Section title="Needs" items={persona.needs} />
        {persona.anti_goals && persona.anti_goals.length > 0 && (
          <Section title="Anti-goals (abandon / distrust triggers)" items={persona.anti_goals} />
        )}
        {persona.channels && persona.channels.length > 0 && (
          <Section title="Channels" items={persona.channels} />
        )}
      </div>

      <section>
        <h2 className="section-label">
          Scenarios
        </h2>
        <ul className="stack-list mt-4" role="list">
          {persona.scenarios.map((s, i) => (
            <li key={i}>
              <p className="text-body font-semibold text-ink">{s.title}</p>
              <p className="text-body text-ink-soft mt-2">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section-label">
          Evidence
        </h2>
        <ul className="stack-list mt-4" role="list">
          {persona.evidence.map((e) => (
            <EvidenceRow key={e.id} e={e} />
          ))}
        </ul>
      </section>

      {persona.tags.length > 0 && (
        <section>
          <h2 className="section-label">
            Tags
          </h2>
          <p className="mt-3 text-body text-ink-soft">{persona.tags.join(" · ")}</p>
        </section>
      )}

      {persona.notes && (
        <section>
          <h2 className="section-label">
            Notes
          </h2>
          <p className="mt-3 text-body text-ink-soft whitespace-pre-wrap">{persona.notes}</p>
        </section>
      )}
    </article>
  );
}
