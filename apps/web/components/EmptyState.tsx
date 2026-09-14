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
    <div className="glass px-8 py-16 text-center">
      <p aria-hidden="true" className="accent-icon text-title leading-none">
        ◎
      </p>
      <h1 className="mt-4 text-title text-ink">{title}</h1>
      <p className="text-body text-muted mt-3 max-w-md mx-auto">{body}</p>
      <Link href={ctaHref} className="btn btn-primary mt-8">
        {ctaLabel}
      </Link>
    </div>
  );
}
