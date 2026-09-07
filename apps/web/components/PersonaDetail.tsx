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
      className={`text-xs font-medium ${hypothesis ? "text-warn" : "text-muted"}`}
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm text-ink-soft" role="list">
        {items.map((item, i) => (
          <li key={i} className="leading-snug">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EvidenceRow({ e }: { e: EvidenceItem }) {
  const isSynthetic = e.source_type === "synthetic";
  return (
    <li
      className={`rounded-md border p-3 ${
        isSynthetic ? "border-warn bg-warn-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">{e.title ?? "Untitled source"}</p>
        <span
          className={`text-xs font-medium uppercase tracking-wide ${
            isSynthetic ? "text-warn" : "text-muted"
          }`}
        >
          {e.source_type}
        </span>
      </div>
      <p className="text-sm text-ink-soft mt-1">{e.summary}</p>
      {e.quote && (
        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-sm italic text-ink-soft">
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
    <article className="space-y-10" aria-labelledby="persona-name">
      <header className="border-b border-line pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
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
            <h1
              id="persona-name"
              className="text-3xl font-semibold text-ink mt-2 break-words"
            >
              {persona.name}
            </h1>
            <p className="text-sm text-muted mt-1">
              {persona.archetype} <span aria-hidden>·</span> {persona.role}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/personas/${persona.id}/edit`}
              className="inline-flex items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-line-strong transition"
            >
              Edit
            </Link>
          </div>
        </div>
        {persona.quote && (
          <blockquote className="mt-5 border-l-2 border-accent pl-3 italic text-ink-soft">
            “{persona.quote}”
          </blockquote>
        )}
        <p className="mt-5 text-base text-ink-soft max-w-2xl">{persona.summary}</p>
        <div className="mt-4 flex items-center gap-3" aria-label={conf.label}>
          <ConfidenceMeter value={persona.confidence} showLabel={false} />
          <span className="text-xs text-muted">{conf.label}</span>
        </div>
      </header>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Primary goal
        </h3>
        <p className="mt-2 text-lg text-ink">{persona.primary_goal}</p>
        {persona.job_to_be_done && (
          <p className="mt-3 text-sm text-ink-soft max-w-2xl">
            <span className="font-medium text-muted">Job to be done: </span>
            {persona.job_to_be_done}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Scenarios
        </h3>
        <ul className="mt-2 space-y-3" role="list">
          {persona.scenarios.map((s, i) => (
            <li key={i} className="rounded-md border border-line bg-surface p-3">
              <p className="text-sm font-medium text-ink">{s.title}</p>
              <p className="text-sm text-ink-soft mt-1">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Evidence
        </h3>
        <ul className="mt-2 space-y-3" role="list">
          {persona.evidence.map((e) => (
            <EvidenceRow key={e.id} e={e} />
          ))}
        </ul>
      </section>

      {persona.tags.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Tags
          </h3>
          <p className="mt-2 text-sm text-ink-soft">{persona.tags.join(" · ")}</p>
        </section>
      )}

      {persona.notes && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Notes
          </h3>
          <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">
            {persona.notes}
          </p>
        </section>
      )}
    </article>
  );
}
