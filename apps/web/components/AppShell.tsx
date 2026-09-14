"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Workspace", match: (p: string) => p === "/" },
  { href: "/councils", label: "Councils", match: (p: string) => p.startsWith("/councils") },
  {
    href: "/competitive-research",
    label: "Competitive research",
    match: (p: string) => p.startsWith("/competitive-research"),
  },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="app-header z-40 sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="choice-target flex items-center gap-3 min-w-0">
            <span aria-hidden="true" className="brand-mark">p</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-section font-bold text-ink">
                AI Persona Lab
              </span>
              <span className="block text-meta text-muted">Review workspace</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.match(pathname) ? "page" : undefined}
                className="nav-link"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/personas/new" className="btn btn-primary">
              + New persona
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        {/* key is here only so the push-slide entry replays per route; the
            App Router already swaps this subtree on a pathname change. */}
        <div key={pathname} className="route-enter mx-auto max-w-6xl px-6 py-10">
          {children}
        </div>
      </main>
      <footer className="border-t border-line/70 bg-transparent">
        <div className="mx-auto max-w-6xl px-6 py-4 text-meta text-muted">
          Local library · Independent perspectives · Evidence before confidence
        </div>
      </footer>
    </div>
  );
}
