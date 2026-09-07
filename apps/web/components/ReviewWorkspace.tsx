"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { PersonaSummary } from "@lib/persona";
import PersonaCard from "./PersonaCard";
import { useReviewDraft } from "./useReviewDraft";
import { emptyReviewDraft, type ReviewDraft } from "../../../lib/review-draft.mjs";
import { REVIEW_PRESETS, buildReviewBrief } from "../../../lib/review-presets.mjs";

export default function ReviewWorkspace({ personas }: { personas: PersonaSummary[] }) {
  const { draft, update, setDraft, loaded, storageAvailable } = useReviewDraft();
  const { mode, presetId, artifact, decision, constraints, selected } = draft;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("usable");
  const [limit, setLimit] = useState(6);
  const [notice, setNotice] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [undo, setUndo] = useState<ReviewDraft | null>(null);
  const preview = useRef<HTMLTextAreaElement>(null);
  const artifactField = useRef<HTMLInputElement>(null);
  const decisionField = useRef<HTMLTextAreaElement>(null);
  const preset = REVIEW_PRESETS.find(item => item.id === presetId)!;
  const ready = Boolean(artifact.trim() && decision.trim());
  const references = personas.filter(p => selected.includes(p.id));
  const brief = ready ? buildReviewBrief(preset, { artifact, decision, constraints, mode, personas: references }) : "Add an artifact and review question to preview the complete brief.";
  const filtered = personas.filter(p => (status === "all" || (status === "usable" ? p.status !== "archived" : p.status === status)) && [p.name, p.role, p.archetype, p.summary, p.primary_goal, ...p.tags].join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  function edit(patch: Partial<ReviewDraft>) { update(patch); setNotice(""); setUndo(null); }
  function toggle(id: string) { edit({ selected: selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id] }); }
  async function copyBrief() {
    setAttempted(true);
    if (!ready) {
      setNotice("Add an artifact and a review question before copying.");
      (!artifact.trim() ? artifactField.current : decisionField.current)?.focus();
      return;
    }
    try { await navigator.clipboard.writeText(brief); setNotice("Brief copied. Paste it into your agent with access to the artifact to run the review."); }
    catch { preview.current?.focus(); preview.current?.select(); setNotice("Clipboard unavailable. The brief is selected; copy it manually."); }
  }
  return (
    <div className="space-y-8">
      <section aria-labelledby="workspace-title" className="workspace-intro flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Your next review</p>
          <h1 id="workspace-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose the perspectives.<br /><span className="text-brand">Make the question precise.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Prepare a focused review, then run it in your AI agent. Choose a template, add your question, and copy the brief.</p>
        </div>
        <span className="library-count self-start rounded-full border px-3 py-1.5 text-xs">{personas.length} saved personas · Local library</span>
      </section>

      <section aria-labelledby="template-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="template-title" className="text-base font-semibold">1. Choose a review template</h2><span className="text-xs text-muted">One reviewer by default</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {REVIEW_PRESETS.map((item, index) => <button type="button" key={item.id} aria-pressed={presetId === item.id} disabled={!loaded} onClick={() => edit({ presetId: item.id })} data-tone={item.id} className="template-card rounded-xl border p-5 text-left transition">
            <span className="flex items-center justify-between gap-2 text-xs"><span className="template-eyebrow">0{index + 1} / Three review lenses</span><span aria-hidden="true" className="template-indicator">{presetId === item.id ? "✓" : ""}</span></span>
            <span className="mt-4 block text-lg font-semibold">{item.title}</span><span className="mt-1 block text-sm text-muted">{item.subtitle}</span>
          </button>)}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section aria-labelledby="brief-title" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="brief-title" className="text-base font-semibold">2. Define the review</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{preset.question}</p>
          <fieldset disabled={!loaded} className="mt-5 space-y-1 rounded-lg bg-canvas p-3">
            <legend className="text-sm font-medium">Review effort</legend>
            <label className="choice-target flex items-center gap-3 text-sm"><input type="radio" name="review-effort" checked={mode === "single"} onChange={() => edit({ mode: "single" })} />One reviewer · Three lenses (default)</label>
            <label className="choice-target flex items-center gap-3 text-sm"><input type="radio" name="review-effort" checked={mode === "panel"} onChange={() => edit({ mode: "panel" })} />Three independent reviewers</label>
            <p className="text-xs leading-5 text-muted">{mode === "single" ? "One response uses the checklist. Start here to keep model use small." : "Each reviewer works separately. More input context means higher model use."}</p>
          </fieldset>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium" htmlFor="review-artifact">Artifact and version <span className="text-muted">(required)</span></label>
            <input ref={artifactField} id="review-artifact" required disabled={!loaded} aria-invalid={attempted && !artifact.trim()} aria-describedby="artifact-help artifact-error" className="review-field" value={artifact} onChange={e => edit({ artifact: e.target.value })} placeholder="URL or file path · commit or date" />
            <p id="artifact-help" className="text-xs text-muted">Use a specific version the reviewing agent can access.</p>
            <p id="artifact-error" className="text-sm text-error">{attempted && !artifact.trim() ? "Add the artifact and its version." : ""}</p>
            <div className="flex flex-wrap items-center justify-between gap-2"><label className="text-sm font-medium" htmlFor="review-question">Review question <span className="text-muted">(required)</span></label>{!decision.trim() && <button type="button" disabled={!loaded} onClick={() => { edit({ decision: preset.question }); decisionField.current?.focus(); }} className="quiet-action text-sm text-brand">Use template question</button>}</div>
            <textarea ref={decisionField} id="review-question" required disabled={!loaded} aria-invalid={attempted && !decision.trim()} aria-describedby="question-error" className="review-field min-h-24" value={decision} onChange={e => edit({ decision: e.target.value })} placeholder="What should the review help you decide?" />
            <p id="question-error" className="text-sm text-error">{attempted && !decision.trim() ? "Add the question this review should answer." : ""}</p>
            <label className="block text-sm font-medium" htmlFor="review-constraints">Constraints <span className="text-muted">(optional)</span></label>
            <textarea id="review-constraints" disabled={!loaded} className="review-field min-h-20" value={constraints} onChange={e => edit({ constraints: e.target.value })} placeholder="Scope, deadline, and actions requiring approval" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">{storageAvailable ? "Draft kept in this browser tab. Nothing sent to a model." : "Tab storage unavailable. Copy your brief before leaving."}</p><button type="button" disabled={!loaded} onClick={() => { setUndo(draft); setDraft(emptyReviewDraft()); setAttempted(false); setNotice("Draft cleared."); }} className="quiet-action text-xs text-muted">Clear draft</button></div>
          {undo && <button type="button" className="quiet-action text-sm text-brand" onClick={() => { setDraft(undo); setUndo(null); setNotice("Draft restored."); }}>Undo clear</button>}
        </section>
        <section aria-labelledby="panel-title" data-tone={presetId} className="review-panel rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="panel-title" className="text-base font-semibold">{mode === "panel" ? "Your review panel" : "Your review checklist"}</h2><span className="text-xs text-muted">{mode === "panel" ? "3 reviewers · 1 pass each" : "1 reviewer · 3 lenses"}</span></div>
          <ol className="mt-2 divide-y divide-line">
            {preset.lenses.map((lens, index) => <li key={lens.role} className="flex gap-3 py-4"><span className="lens-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{index + 1}</span><div><h3 className="text-sm font-semibold">{lens.name}</h3><p className="mt-1 text-sm leading-5 text-muted">{lens.focus}</p><p className="mt-2 text-xs font-medium text-ink-soft">{(mode === "single" || lens.recall === "none") ? "Fresh context · No prior recall" : `${lens.recall === "project" ? "Project" : "Artifact"} recall · Reusable role`}</p></div></li>)}
          </ol>
          <div className="rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">{mode === "panel" ? "Target: 150 output words per reviewer, 450 total." : "Target: one response, at most 450 words."} Input and reasoning tokens are additional. Synthetic perspectives generate hypotheses, not user validation.</div>
        </section>
      </div>

      <details className="reference-disclosure rounded-xl border border-line bg-surface">
        <summary className="choice-target cursor-pointer p-5 text-sm font-semibold">Optional: attach saved personas <span className="ml-2 font-normal text-muted">{references.length} selected · {personas.length} available</span></summary>
        <section aria-label="Persona references" className="space-y-4 border-t border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">Add relevant profile summaries to the brief. References do not add reviewers.</p><Link href="/personas/new" className="quiet-action text-sm text-brand">Create a persona</Link></div>
          <div className="flex flex-col gap-3 sm:flex-row"><label className="flex-1 text-xs font-medium">Search library<input type="search" className="review-field mt-1" placeholder="Name, role, goal or tag" value={search} onChange={e => { setSearch(e.target.value); setLimit(6); }} /></label><label className="text-xs font-medium">Status<select className="review-field mt-1 sm:w-44" value={status} onChange={e => { setStatus(e.target.value); setLimit(6); }}><option value="usable">Active and draft</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="all">All statuses</option></select></label></div>
          <p aria-live="polite" className="text-xs text-muted">{Math.min(limit, filtered.length)} of {filtered.length} matching personas shown</p>
          {filtered.length ? <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.slice(0, limit).map(persona => <div key={persona.id} className="flex min-w-0 flex-col gap-2"><label className="choice-target flex items-center gap-3 text-xs text-muted"><input type="checkbox" disabled={!loaded} checked={selected.includes(persona.id)} onChange={() => toggle(persona.id)} />Attach {persona.name} as reference</label><PersonaCard persona={persona} /></div>)}</div> : <div className="rounded-lg border border-dashed border-line-strong p-6"><p className="font-medium">{personas.length ? "No matching personas" : "No saved personas yet"}</p><p className="mt-2 text-sm text-muted">{personas.length ? "Try another name or status. Your selected references are kept." : "You can prepare a review using the template alone."}</p></div>}
          {filtered.length > limit && <button type="button" onClick={() => setLimit(current => current + 6)} className="quiet-action rounded-lg border border-line-strong text-sm">Show 6 more personas</button>}
        </section>
      </details>

      <section aria-labelledby="preview-title" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="preview-title" className="text-base font-semibold">3. Copy to your agent</h2><p className="mt-1 text-sm text-muted">{ready ? "Ready to copy. The reviewing agent needs access to your artifact." : "Add an artifact and question to prepare the brief."}</p></div><button type="button" disabled={!loaded} onClick={copyBrief} className="brand-button choice-target rounded-lg px-4 text-sm font-medium text-white">Copy review brief</button></div>
        {references.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Selected references">{references.map(p => <button key={p.id} type="button" className="quiet-action rounded-full border border-line text-xs" aria-label={`Remove ${p.name} reference`} onClick={() => toggle(p.id)}>{p.name} <span aria-hidden="true">×</span></button>)}</div>}
        {selected.length > references.length && <p className="mt-2 text-sm text-muted">Some saved references are no longer available and will not be included.</p>}
        <textarea ref={preview} aria-label="Review brief preview" readOnly value={brief} className="review-field mt-4 min-h-40 resize-y font-mono text-xs leading-6" />
        <p role="status" className="mt-2 min-h-5 text-sm text-muted">{notice}</p>
        <p className="mt-3 text-xs leading-5 text-muted">Copying prepares instructions; it does not run a review or save a council. Paste the brief into Codex or Claude with the artifact. Check the returned findings against evidence before changing the product.</p>
      </section>
    </div>
  );
}
