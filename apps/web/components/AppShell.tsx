"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="choice-target flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="brand-mark">p</span>
            <span className="text-lg font-semibold text-ink truncate">
              Persona Lab
            </span>
            <span className="text-xs text-muted">Review workspace</span>
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-3">
            <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className="quiet-action text-sm font-medium">Workspace</Link>
            <Link
              href="/councils"
              aria-current={pathname.startsWith("/councils") ? "page" : undefined}
              className="choice-target inline-flex items-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-line-strong transition"
            >
              Councils
            </Link>
            <Link
              href="/competitive-research"
              aria-current={pathname.startsWith("/competitive-research") ? "page" : undefined}
              className="choice-target inline-flex items-center rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-line-strong transition"
            >
              Competitive research
            </Link>
            <Link
              href="/personas/new"
              className="brand-button choice-target inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white transition"
            >
              + New persona
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-3 text-xs text-muted">
          Local library · Independent perspectives · Evidence before confidence
        </div>
      </footer>
    </div>
  );
}
