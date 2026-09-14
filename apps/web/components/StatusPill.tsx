import type { PersonaStatus } from "@lib/persona";
import { statusLabel } from "@lib/format";

// Status is text colour only — never a filled badge.
export default function StatusPill({ status }: { status: PersonaStatus }) {
  const tone =
    status === "active"
      ? "text-success"
      : status === "draft"
        ? "text-warn"
        : "text-muted";
  return (
    <span
      className={`text-meta font-semibold uppercase tracking-wide ${tone}`}
      aria-label={`Status: ${statusLabel(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
