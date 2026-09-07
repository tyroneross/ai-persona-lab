export function confidenceLabel(c: number): { label: string; tone: "low" | "med" | "high" } {
  if (c >= 0.7) return { label: `${Math.round(c * 100)}% confidence`, tone: "high" };
  if (c >= 0.4) return { label: `${Math.round(c * 100)}% confidence`, tone: "med" };
  return { label: `${Math.round(c * 100)}% confidence`, tone: "low" };
}

export function statusLabel(s: "draft" | "active" | "archived"): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
