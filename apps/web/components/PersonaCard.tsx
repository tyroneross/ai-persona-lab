import Link from "next/link";
import type { PersonaSummary } from "@lib/persona";
import ConfidenceMeter from "./ConfidenceMeter";
import StatusPill from "./StatusPill";

export default function PersonaCard({ persona }: { persona: PersonaSummary }) {
  return (
    <Link
      href={`/personas/${persona.id}`}
      className="block h-full rounded-lg border border-line bg-surface p-4 hover:border-line-strong hover:shadow-sm transition"
      aria-label={`Open ${persona.name} persona`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink truncate">{persona.name}</h2>
        <StatusPill status={persona.status} />
      </div>
      <p className="text-xs text-muted mt-0.5">
        {persona.archetype} <span aria-hidden>·</span> {persona.role}
      </p>
      <p className="text-sm text-ink-soft mt-3 line-clamp-3">{persona.summary}</p>
      <p className="text-xs text-muted mt-3 italic">
        <span className="not-italic font-medium text-ink-soft">Goal:</span>{" "}
        {persona.primary_goal}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <ConfidenceMeter value={persona.confidence} size="sm" />
        {persona.tags.length > 0 && (
          <span className="text-xs text-muted truncate text-right">
            {persona.tags.slice(0, 3).join(" · ")}
          </span>
        )}
      </div>
    </Link>
  );
}
