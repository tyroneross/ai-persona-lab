import Link from "next/link";

export default function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface px-8 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="text-sm text-muted mt-2 max-w-md mx-auto">{body}</p>
      <Link
        href={ctaHref}
        className="inline-flex mt-6 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft transition"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
