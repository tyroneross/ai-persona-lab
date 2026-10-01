"use client";

import { useMemo, useState } from "react";
import { LENNY_CATALOG, browseLennyRoles, selectLennyPersonas, findLennyRole, type LennySelection } from "../../../lib/lenny-catalog.mjs";

export default function LennyPersonaChooser({ question, selections, disabled, onChange }: {
  question: string; selections: LennySelection[]; disabled: boolean; onChange: (value: LennySelection[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [browse, setBrowse] = useState(false);
  const [limit, setLimit] = useState(6);
  const plan = useMemo(() => selectLennyPersonas(question), [question]);
  const matches = new Map(plan.results.map(item => [item.role_id, item]));
  const roles = browseLennyRoles(search).filter(role => browse || matches.has(role.id) || selections.some(item => item.role_id === role.id));
  function toggleRole(id: string) {
    onChange(selections.some(item => item.role_id === id) ? selections.filter(item => item.role_id !== id) : [...selections, { role_id: id, speaker_ids: [] }]);
  }
  function toggleSource(roleId: string, speakerId: string) {
    onChange(selections.map(item => item.role_id === roleId ? { ...item, speaker_ids: item.speaker_ids.includes(speakerId) ? item.speaker_ids.filter(id => id !== speakerId) : [...item.speaker_ids, speakerId] } : item));
  }
  const ordered = [...roles].sort((a, b) => (matches.get(b.id)?.score || 0) - (matches.get(a.id)?.score || 0) || (matches.has(a.id) && matches.has(b.id) ? a.id.localeCompare(b.id) : a.name.localeCompare(b.name)));
  return <section aria-labelledby="lenny-title" className="glass min-w-0 space-y-5 p-6 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="lenny-title" className="text-section text-ink">Choose Lenny podcast perspectives</h2><p className="mt-2 text-body text-muted">{LENNY_CATALOG.roles.length} review roles · {LENNY_CATALOG.integrity.expert_speakers} eligible speaker sources · Index {LENNY_CATALOG.source_date}</p></div>
      <span className="text-meta text-muted" aria-live="polite">{selections.length} roles selected</span>
    </div>
    <p className="text-body text-muted">Suggestions use the words in your review question. Check each role’s question and responsibility, then optionally choose speakers as source context. These choices add checklist context to your brief; they do not add reviewer passes.</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-meta font-medium">Search roles or speakers<input type="search" className="review-field mt-1" value={search} placeholder="Pricing, Nancy Duarte, engineering…" onChange={event => { setSearch(event.target.value); setLimit(6); if (event.target.value) setBrowse(true); }} /></label>
      <button type="button" className="btn btn-secondary" aria-pressed={browse} onClick={() => { setBrowse(!browse); setLimit(6); }}>{browse ? "Show question matches" : "Browse all roles"}</button>
    </div>
    {selections.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Selected Lenny roles">{selections.map(item => <button key={item.role_id} disabled={disabled} type="button" className="quiet-action max-w-full rounded-full border border-line text-meta" aria-label={`Remove ${findLennyRole(item.role_id).name}`} onClick={() => toggleRole(item.role_id)}>{findLennyRole(item.role_id).name} ×</button>)}</div>}
    {(!ordered.length || (!browse && !search && !plan.results.length)) && <p className="glass-sunken p-4 text-body text-muted">{search ? "No roles or speakers match this search. Try another term." : plan.next_step}</p>}
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {ordered.slice(0, limit).map(role => {
        const selected = selections.find(item => item.role_id === role.id);
        const match = matches.get(role.id);
        return <article key={role.id} className="glass-sunken min-w-0 space-y-3 break-words p-5">
          <label className="choice-target flex items-start gap-3 text-body font-semibold"><input type="checkbox" disabled={disabled} checked={Boolean(selected)} className="mt-1 shrink-0" onChange={() => toggleRole(role.id)} />{role.name}</label>
          <p className="text-body text-ink">{role.primary_question}</p>
          <p className="text-meta text-muted"><strong>Owns:</strong> {role.owns}</p>
          <p className="text-meta text-muted"><strong>Refer elsewhere:</strong> {role.excludes}</p>
          <p className="text-meta text-brand-text">{match ? `Why this matches: ${match.reason}` : "Manual choice · No specific question match"}</p>
          <details>
            <summary className="choice-target cursor-pointer text-meta font-medium">Speaker source candidates · {role.sources.length} available · {selected?.speaker_ids.length || 0} chosen</summary>
            <p className="my-3 text-meta text-muted">Select the role to attach sources. Mappings and passages are provisional; a source name does not establish specialist competence.</p>
            <div className="max-h-80 space-y-4 overflow-y-auto pr-2">
              {role.sources.map(source => <div key={source.speaker_id} className="border-t border-line pt-3">
                <label className="choice-target flex items-center gap-3 text-meta"><input type="checkbox" disabled={disabled || !selected} checked={selected?.speaker_ids.includes(source.speaker_id) || false} onChange={() => toggleSource(role.id, source.speaker_id)} />{source.name}</label>
                <details className="mt-1 text-meta text-muted"><summary className="choice-target cursor-pointer">Inspect candidate passages from {source.name}</summary>{source.evidence.map((evidence, index) => <div key={index} className="mt-3 space-y-2"><p>{evidence.source_path} · {evidence.timestamp} · {evidence.episode_publish_date || "Date unknown"}</p><blockquote className="border-l-2 border-line pl-3">{evidence.excerpt}</blockquote><p className="break-all">Source codepoints {evidence.source_start}–{evidence.source_end} · SHA-256 {evidence.source_sha256}</p></div>)}</details>
              </div>)}
            </div>
          </details>
        </article>;
      })}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-meta text-muted">{Math.min(limit, ordered.length)} of {ordered.length} roles shown</p>{ordered.length > limit && <button type="button" className="btn btn-secondary" onClick={() => setLimit(value => value + 6)}>Show more roles</button>}</div>
    <p className="text-meta text-muted">Draft source mappings generate hypotheses. They do not validate user needs or imply guest endorsement. Add audience, accessibility, and specialist perspectives when the catalog does not cover them.</p>
  </section>;
}
