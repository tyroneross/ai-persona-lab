import Link from "next/link";
import type { PersonaSummary } from "@lib/persona";
import ConfidenceMeter from "./ConfidenceMeter";
import StatusPill from "./StatusPill";

export default function PersonaCard({ persona }: { persona: PersonaSummary }) {
  return (
    <Link
      href={`/personas/${persona.id}`}
      className="glass glass-card block h-full p-5 transition hover:border-brand"
      aria-label={`Open ${persona.name} persona`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section text-ink truncate">{persona.name}</h2>
        <StatusPill status={persona.status} />
      </div>
      <p className="text-meta text-muted mt-1">
        {persona.archetype} <span aria-hidden>·</span> {persona.role}
      </p>
      <p className="text-body text-ink-soft mt-4 line-clamp-3">{persona.summary}</p>
      <p className="text-meta text-muted mt-4">
        <span className="font-medium text-ink-soft">Goal:</span> {persona.primary_goal}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-meta text-muted">
        <span>{persona.provenance ? persona.provenance.replaceAll("-", " ") : "Evidence basis unspecified"}</span>
        <span>· Recall: {persona.recall || "unspecified"}</span>
        <span>· {persona.lifespan || "Lifespan unspecified"}</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <ConfidenceMeter value={persona.confidence} size="sm" />
        {persona.tags.length > 0 && (
          <span className="text-meta text-muted truncate text-right">
            {persona.tags.slice(0, 3).join(" · ")}
          </span>
        )}
      </div>
    </Link>
  );
}
