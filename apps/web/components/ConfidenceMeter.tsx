import { confidenceLabel } from "@lib/format";

export default function ConfidenceMeter({
  value,
  size = "md",
  showLabel = true,
}: {
  value: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const conf = confidenceLabel(value);
  const fill =
    conf.tone === "high"
      ? "var(--color-success)"
      : conf.tone === "med"
        ? "var(--color-warn)"
        : "var(--color-muted)";
  const tone =
    conf.tone === "high"
      ? "text-success"
      : conf.tone === "med"
        ? "text-warn"
        : "text-muted";
  const trackWidth = size === "sm" ? "w-16" : "w-24";
  return (
    <div className="flex items-center gap-2" aria-label={conf.label}>
      <div className={`confidence-track ${trackWidth}`} role="presentation">
        <div
          className="confidence-fill"
          style={{ width: `${Math.round(value * 100)}%`, background: fill }}
        />
      </div>
      {showLabel && <span className={`text-xs ${tone}`}>{conf.label}</span>}
    </div>
  );
}
