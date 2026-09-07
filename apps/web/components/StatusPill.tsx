import type { PersonaStatus } from "@lib/persona";
import { statusLabel } from "@lib/format";

export default function StatusPill({ status }: { status: PersonaStatus }) {
  const tone =
    status === "active"
      ? "text-success"
      : status === "draft"
        ? "text-warn"
        : "text-muted";
  return (
    <span
      className={`text-xs font-medium uppercase tracking-wide ${tone}`}
      aria-label={`Status: ${statusLabel(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}
