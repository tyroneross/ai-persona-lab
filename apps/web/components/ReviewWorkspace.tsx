"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { PersonaSummary } from "@lib/persona";
import PersonaCard from "./PersonaCard";
import { REVIEW_PRESETS, buildReviewBrief } from "../../../lib/review-presets.mjs";

export default function ReviewWorkspace({ personas }: { personas: PersonaSummary[] }) {
  const [mode, setMode] = useState<"single" | "panel">("single");
  const [presetId, setPresetId] = useState("handoff");
  const [artifact, setArtifact] = useState("");
  const [decision, setDecision] = useState("");
  const [constraints, setConstraints] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("usable");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const preview = useRef<HTMLTextAreaElement>(null);
  const preset = REVIEW_PRESETS.find((item) => item.id === presetId)!;
  const ready = Boolean(artifact.trim() && decision.trim());
  const references = personas.filter((p) => selected.includes(p.id));
  const brief = ready ? buildReviewBrief(preset, { artifact, decision, constraints, mode, personas: references }) : "Add an artifact and review question to preview the complete brief.";
  const visible = personas.filter((p) => (status === "all" || (status === "usable" ? p.status !== "archived" : p.status === status)) && [p.name, p.role, p.archetype, p.summary, p.primary_goal, ...p.tags].join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  function edited() { setNotice(""); }
  async function copyBrief() {
    try { await navigator.clipboard.writeText(brief); setNotice("Brief copied. Paste it into your agent to start the review."); }
    catch { preview.current?.focus(); preview.current?.select(); setNotice("Clipboard unavailable. The brief is selected; copy it manually."); }
  }
  return (
    <div className="space-y-10">
      <section aria-labelledby="workspace-title" className="workspace-intro flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Your next review</p>
          <h1 id="workspace-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose the perspectives.<br /><span className="text-brand">Make the question precise.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Start with one reviewer and a focused checklist. Add independent reviewers when the decision needs more scrutiny.</p>
        </div>
        <span className="library-count self-start rounded-full border px-3 py-1.5 text-xs">{personas.length} saved personas · Local library</span>
      </section>

      <section aria-labelledby="template-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="template-title" className="text-base font-semibold">1. Start with a review template</h2><span className="text-xs text-muted">Recommended starting points · Still being evaluated</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {REVIEW_PRESETS.map((item, index) => <button type="button" key={item.id} aria-pressed={presetId === item.id} onClick={() => { setPresetId(item.id); edited(); }} data-tone={item.id} className="template-card rounded-xl border p-5 text-left transition">
            <span className="flex items-center justify-between gap-2 text-xs"><span className="template-eyebrow">0{index + 1} / Three review lenses</span><span aria-hidden="true" className="template-indicator">{presetId === item.id ? "✓" : ""}</span></span>
            <span className="mt-4 block text-lg font-semibold">{item.title}</span>
            <span className="mt-1 block text-sm text-muted">{item.subtitle}</span>
          </button>)}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section aria-labelledby="brief-title" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="brief-title" className="text-base font-semibold">2. Define the review</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{preset.question}</p>
          <fieldset className="mt-5 space-y-2 rounded-lg bg-canvas p-3">
            <legend className="text-sm font-medium">Review effort</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="review-effort" checked={mode === "single"} onChange={() => { setMode("single"); edited(); }} />One reviewer · Checklist (default)</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="review-effort" checked={mode === "panel"} onChange={() => { setMode("panel"); edited(); }} />Three independent reviewers</label>
            <p className="text-xs leading-5 text-muted">Our first handoff pilot found equal issue coverage. Start with one call; use the panel when independent scrutiny warrants the extra input cost.</p>
          </fieldset>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">Artifact and version <span className="text-muted">(required)</span><input className="review-field mt-2" value={artifact} onChange={(e) => { setArtifact(e.target.value); edited(); }} placeholder="Repository/path, URL or document · commit or date" /></label>
            <label className="block text-sm font-medium">Review question <span className="text-muted">(required)</span><textarea className="review-field mt-2 min-h-24" value={decision} onChange={(e) => { setDecision(e.target.value); edited(); }} placeholder="What should the reviewers help you decide?" /></label>
            <label className="block text-sm font-medium">Constraints <span className="text-muted">(optional)</span><textarea className="review-field mt-2 min-h-20" value={constraints} onChange={(e) => { setConstraints(e.target.value); edited(); }} placeholder="Project, scope, deadline, and actions requiring approval" /></label>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">This draft stays on this page until you copy it; navigating away clears it. Preparing a brief does not run reviewers or save a council.</p>
        </section>
        <section aria-labelledby="panel-title" data-tone={presetId} className="review-panel rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h2 id="panel-title" className="text-base font-semibold">{mode === "panel" ? "Your review panel" : "Your review checklist"}</h2><span className="rounded-full bg-canvas px-2.5 py-1 text-xs text-muted">{mode === "panel" ? "3 reviewers · 1 pass each" : "1 reviewer · 3 lenses"}</span></div>
          <ol className="mt-2 divide-y divide-line">
            {preset.lenses.map((lens, index) => <li key={lens.role} className="flex gap-3 py-4"><span className="lens-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{index + 1}</span><div><h3 className="text-sm font-semibold">{lens.name}</h3><p className="mt-1 text-sm leading-5 text-muted">{lens.focus}</p><p className="mt-2 text-xs font-medium text-ink-soft">{(mode === "single" || lens.recall === "none") ? "Fresh context · No prior recall" : `${lens.recall === "project" ? "Project" : "Artifact"} recall · Reusable role`}</p></div></li>)}
          </ol>
          <div className="rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">{mode === "panel" ? "Target: 150 output words per reviewer, 450 total." : "Target: one response, at most 450 words. No prior recall."} Input and reasoning tokens are additional. These perspectives generate hypotheses; they do not establish user validation.</div>
        </section>
      </div>

      <section aria-labelledby="preview-title" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="preview-title" className="text-base font-semibold">3. Inspect and copy the brief</h2><p className="mt-1 text-xs text-muted">{references.length} saved references attached · {mode === "panel" ? "Reviewers remain independent" : "One reviewer uses the checklist"}</p></div><button type="button" disabled={!ready} onClick={copyBrief} className="brand-button rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Copy review brief</button></div>
        <textarea ref={preview} aria-label="Review brief preview" readOnly value={brief} className="review-field mt-4 min-h-48 resize-y font-mono text-xs leading-6" />
        <p role="status" className="mt-2 min-h-5 text-sm text-muted">{notice}</p>
      </section>

      <section aria-labelledby="library-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="library-title" className="text-xl font-semibold">Your persona library</h2><p className="mt-1 text-sm text-muted">Attach relevant profiles as references. Template lenses work without saved personas.</p></div><Link href="/personas/new" className="text-sm font-medium underline underline-offset-4">Create a persona</Link></div>
        <div className="flex flex-col gap-3 sm:flex-row"><label className="flex-1 text-xs font-medium">Search library<input type="search" className="review-field mt-1" placeholder="Name, role, goal or tag" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label className="text-xs font-medium">Status<select className="review-field mt-1 sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="usable">Active and draft</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="all">All statuses</option></select></label></div>
        <p aria-live="polite" className="text-xs text-muted">{visible.length} of {personas.length} personas shown · {selected.length} selected{selected.length > 0 && <button type="button" onClick={() => { setSelected([]); edited(); }} className="ml-3 underline underline-offset-4">Clear references</button>}</p>
        {visible.length ? <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((persona) => <div key={persona.id} className="flex min-w-0 flex-col gap-2"><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={selected.includes(persona.id)} onChange={() => { setSelected((current) => current.includes(persona.id) ? current.filter((id) => id !== persona.id) : [...current, persona.id]); edited(); }} />Attach {persona.name} as reference</label><PersonaCard persona={persona} /></div>)}</div> : <div className="rounded-xl border border-dashed border-line-strong p-8 text-center"><p className="font-medium">{personas.length ? "No matching personas" : "Your library starts here"}</p><p className="mt-2 text-sm text-muted">{personas.length ? "Change the search or status filter. Your brief and references are preserved." : "Use a template above, or create your first persona when you have evidence to preserve."}</p></div>}
      </section>
    </div>
  );
}
