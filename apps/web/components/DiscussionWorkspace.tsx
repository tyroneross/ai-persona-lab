'use client';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import type {PersonaSummary} from '@lib/persona';
import LennyPersonaChooser from './LennyPersonaChooser';
import type {LennySelection} from '../../../lib/lenny-catalog.mjs';
import {discussionResult, discussionTurnCount, nextDiscussionTurn, searchDiscussion, type Discussion, type DiscussionMessage} from '../../../lib/discussion.mjs';

type Props = {personas:PersonaSummary[];discussions:Discussion[];initialRoom?:Discussion;warnings?:string[]};
const modeHelp = {explore:'Compare perspectives and capture disagreements without requiring a decision.', consensus:'Debate, propose one statement, then ask each persona to agree, object, or abstain. Consensus requires everyone to agree.', vote:'Debate fixed options, then cast one private ballot per persona. Show counts, ties, abstentions, and reasons.'};

export default function DiscussionWorkspace({personas,discussions,initialRoom,warnings=[]}:Props) {
  const router = useRouter();
  const [room,setRoom] = useState(initialRoom);
  const [topic,setTopic] = useState(''); const [goal,setGoal] = useState(''); const [context,setContext] = useState('');
  const [mode,setMode] = useState<Discussion['mode']>('explore'); const [rounds,setRounds] = useState(2);
  const [optionText,setOptionText] = useState(''); const [selected,setSelected] = useState<string[]>([]);
  const [lenny,setLenny] = useState<LennySelection[]>([]); const [personaQuery,setPersonaQuery] = useState('');
  const [model,setModel] = useState(''); const [models,setModels] = useState<string[]>([]); const [modelLabels,setModelLabels] = useState<Record<string,string>>({}); const [modelError,setModelError] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [creating,setCreating] = useState(false); const [error,setError] = useState('');
  const [query,setQuery] = useState(''); const [speaker,setSpeaker] = useState(''); const [highlighted,setHighlighted] = useState(''); const [jump,setJump] = useState(0);
  const [,setTick] = useState(0); const stop = useRef(false);
  useEffect(() => {return () => {stop.current = true;};}, []);
  async function loadModels() {
    try {
      const response = await fetch('/api/discussions/models'); const data = await response.json();
      setModels(data.models || []); setModelLabels(Object.fromEntries((data.profiles || []).map((p:{id:string;label:string}) => [p.id,p.label]))); setModelError(data.error);
      setModel(current => data.models?.includes(current) ? current : data.models?.includes(initialRoom?.model) ? initialRoom!.model : data.default_model || '');
    } catch {setModelError('Could not load execution choices. Refresh to retry.');}
  }
  useEffect(() => {void loadModels();}, []); // Model discovery makes no inference calls.
  useEffect(() => {
    if (!room?.pending || room.pending.expires_at <= Date.now()) return;
    let ticks=0;const timer = setInterval(() => {setTick(t => t + 1);if (room.pending!.expires_at <= Date.now()) {clearInterval(timer);return;}if (++ticks % 5 === 0) void reload();},1000); return () => clearInterval(timer);
  }, [room?.pending]);
  useEffect(() => {if (highlighted) {const note=document.getElementById(`note-${highlighted}`);note?.focus({preventScroll:true});note?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'center'});}}, [highlighted,jump]);
  function showNote(id:string) {setQuery('');setSpeaker('');setHighlighted(id);setJump(j=>j+1);}
  async function reload() {
    if (!room) return;
    try {const response = await fetch(`/api/discussions/${room.id}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not refresh this room');setRoom(data.discussion);}
    catch(err) {setError((err as Error).message);}
  }
  async function create(event:React.FormEvent) {
    event.preventDefault();setCreating(true);setError('');
    try {
      const response = await fetch('/api/discussions', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic,goal,context,mode,rounds, options:mode === 'vote' ? optionText.split('\n').map(o => o.trim()).filter(Boolean) : [], model,persona_ids:selected,lenny_selections:lenny})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      router.push(`/discussions/${data.discussion.id}`);
    } catch(err) {setError((err as Error).message);}
    finally {setCreating(false);}
  }
  async function run(all:boolean) {
    if (!room || busy) return;
    stop.current = false;setBusy(true);setError('');let current = room;
    try {
      do {
        const response = await fetch(`/api/discussions/${current.id}/advance`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:current.revision})});
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        current = data.discussion;setRoom(current);
      } while (all && !stop.current && current.status !== 'complete');
    } catch(err) {setError((err as Error).message); await reload();}
    finally {setBusy(false);}
  }
  const participantCount = selected.length + lenny.length;
  const active = personas.filter(p => p.status !== 'archived');
  const filtered = active.filter(p => [p.name,p.role,p.summary].join(' ').toLowerCase().includes(personaQuery.toLowerCase()));
  const result = room ? discussionResult(room) : null;
  const pendingLive = Boolean(room?.pending && room.pending.expires_at > Date.now());
  const next = room && nextDiscussionTurn(room);
  const synthesis = room?.messages.find(m => m.kind === 'synthesis');
  const unsupportedModel = Boolean(room && models.length && !models.includes(room.model));
  function refs(message:DiscussionMessage) {return message.refs.length > 0 && <div className="mt-3 flex flex-wrap gap-2 text-meta"><span className="text-muted">Recorded notes:</span>{message.refs.map(id => <button key={id} aria-label={`Jump to note ${id}`} className="min-w-11 px-2 underline text-brand-text choice-target" onClick={() => showNote(id)}>{id}</button>)}</div>;}
  return <div className="space-y-8">
    <div className="space-y-2">
      <p className="eyebrow">Group discussion</p>
      <h1 className="font-display text-title font-bold text-ink">{room ? room.topic : 'Put perspectives in conversation'}</h1>
      <p className="text-muted max-w-3xl">{room ? room.goal : 'Choose personas, set a topic and goal, and let them respond to one another. An impartial facilitator records agreement, dissent, and next steps.'}</p>
      <p className="text-meta text-muted">Synthetic perspectives and ballots support exploration. They do not measure real user preferences.</p>
    </div>
    {warnings.length > 0 && <div role="status" className="rounded-card border border-line p-4"><p>Some saved discussions could not be read. Other rooms remain available.</p><ul className="text-meta break-words mt-2">{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
    {error && <p role="alert" className="rounded-card border border-line bg-surface p-4 text-ink">{error}</p>}
    {!room ? <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form onSubmit={create} className="space-y-6 min-w-0">
        <section className="rounded-card border border-line bg-surface p-5 space-y-4">
          <h2 className="font-display text-section font-bold">Topic and outcome</h2>
          <label className="block">Topic<input className="review-field mt-2 w-full" value={topic} onChange={e => setTopic(e.target.value)} required placeholder="Which onboarding approach should we use?" /></label>
          <label className="block">Goal<textarea className="review-field mt-2 w-full" rows={2} value={goal} onChange={e => setGoal(e.target.value)} required placeholder="Choose an approach and identify its tradeoffs." /></label>
          <label className="block">Evidence and context<textarea className="review-field mt-2 w-full" rows={4} value={context} onChange={e => setContext(e.target.value)} placeholder="Paste UI descriptions, constraints, observations, or notes. Links alone do not supply their contents." /></label>
          <label className="block">Discussion mode<select className="review-field mt-2 w-full" value={mode} onChange={e => setMode(e.target.value as Discussion['mode'])}><option value="explore">Explore opinions</option><option value="consensus">Seek consensus</option><option value="vote">Vote on options</option></select></label>
          <p className="text-meta text-muted">{modeHelp[mode]}</p>
          {mode === 'vote' && <label className="block">Options — one per line<textarea className="review-field mt-2 w-full" rows={4} value={optionText} onChange={e => setOptionText(e.target.value)} required placeholder={'Guided wizard\nSingle-page setup'} /><span className="block text-meta text-muted mt-1">At least two distinct options. Each persona can also abstain.</span></label>}
          <label className="block">Reply rounds<input className="review-field mt-2 w-full" type="number" min={1} step={1} value={rounds} onChange={e => setRounds(Number(e.target.value))} required /></label>
          <p className="text-meta text-muted">One independent opening per persona, then {rounds || 0} rounds of replies. More rounds require more model calls.</p>
        </section>
        <section className="rounded-card border border-line bg-surface p-5 space-y-4">
          <h2 className="font-display text-section font-bold">Participants · {participantCount} selected</h2>
          <p className="text-meta text-muted">Choose at least two. Include the people affected by the decision and a lens that can challenge your preferred approach.</p>
          <label className="block">Search saved personas<input className="review-field mt-2 w-full" type="search" value={personaQuery} onChange={e => setPersonaQuery(e.target.value)} /></label>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.map(p => <label key={p.id} className="flex gap-3 rounded-button border border-line p-3 cursor-pointer"><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids,p.id] : ids.filter(id => id !== p.id))} /><span className="min-w-0"><span className="block font-semibold">{p.name}</span><span className="block text-meta text-muted">{p.role} · {p.primary_goal}</span></span></label>)}
            {!active.length && <p className="text-muted">No saved personas yet. Choose Lenny role lenses below or <Link className="underline inline-flex min-h-11 items-center" href="/personas/new">create a persona</Link>.</p>}
            {active.length > 0 && !filtered.length && <p className="text-muted">No matching saved personas.</p>}
          </div>
          <LennyPersonaChooser usage="discussion" question={[topic,goal,context].join(' ')} selections={lenny} onChange={setLenny} disabled={creating} />
          <p className="text-meta text-muted">Each selected Lenny role becomes one synthetic participant. Selected guest passages inform that lens; it does not speak for the guest.</p>
        </section>
        <section className="rounded-card border border-line bg-surface p-5 space-y-4">
          <h2 className="font-display text-section font-bold">Execution model</h2>
          <label className="block">Model<select aria-label="Execution model" className="review-field mt-2 w-full" value={model} onChange={e => setModel(e.target.value)} required>{!models.includes(model) && <option value="">Choose a model</option>}{models.map(m => <option key={m} value={m}>{modelLabels[m] || m}</option>)}</select></label>
          <p className="text-meta text-muted">Runs through your signed-in Codex or Claude CLI. The selected provider receives the participant briefs, context, and recorded conversation. Each turn starts a fresh session.</p>
          {modelError && <p className="text-meta text-muted">{modelError}</p>}
          <button type="button" className="btn btn-secondary" onClick={() => void loadModels()}>Refresh models</button>
          <p className="text-meta text-muted">Creation saves the setup. Run the room when ready. No model calls occur until you start it.</p>
          <button className="btn btn-primary" type="submit" disabled={creating || participantCount < 2 || !model}>{creating ? 'Saving…' : 'Create discussion'}</button>
        </section>
      </form>
      <aside className="min-w-0 space-y-4">
        <h2 className="font-display text-section font-bold">Saved discussions</h2>
        {discussions.map(d => <Link key={d.id} href={`/discussions/${d.id}`} className="block rounded-card border border-line bg-surface p-4"><span className="block font-semibold break-words">{d.topic}</span><span className="block text-meta text-muted mt-2">{d.mode} · {d.participants.length} personas · {d.status}</span></Link>)}
        {!discussions.length && <p className="text-muted">Your recorded rooms will appear here.</p>}
      </aside>
    </div> : <>
      <section className="rounded-card border border-line bg-surface p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-center"><Link className="underline text-meta inline-flex min-h-11 items-center" href="/discussions">All discussions / new room</Link><span className="text-meta text-muted">{room.mode} · {room.participants.length} personas · {modelLabels[room.model] || room.model}</span></div>
        <p aria-live="polite" className="font-semibold">{room.status === 'complete' ? 'Discussion complete' : busy || pendingLive ? `Recording ${next?.kind || 'turn'}…` : room.error ? 'Turn failed — earlier notes saved' : 'Ready to continue'} · {room.messages.length}/{discussionTurnCount(room)} recorded turns</p>
        {room.error && <p className="text-meta text-muted">{room.error}</p>}
        {unsupportedModel && <p className="text-meta text-muted">This room uses an older execution model. Its notes remain available. Create a new room with Luna High or Sonnet to run a discussion.</p>}
        {room.pending && !pendingLive && <p className="text-meta text-muted">The previous turn expired. Resume will retry that turn and reject any late result.</p>}
        {next && <p className="text-meta text-muted">Next: {room.participants.find(p => p.id === next.speaker_id)?.name || 'Facilitator'} · {next.kind} · round {next.round}</p>}
        <div className="flex flex-wrap gap-3">
          {room.status !== 'complete' && <><button className="btn btn-primary" disabled={busy || pendingLive || unsupportedModel} onClick={() => void run(true)}>Run / resume discussion</button><button className="btn btn-secondary" disabled={busy || pendingLive || unsupportedModel} onClick={() => void run(false)}>Record next turn</button></>}
          {busy && <button className="btn btn-secondary" onClick={() => {stop.current = true;}}>Pause after this turn</button>}
          <button className="btn btn-secondary" disabled={busy} onClick={() => void reload()}>Refresh room</button>
          <a className="btn btn-secondary" href="#discussion-notes">Search recorded notes</a>
          <a className="btn btn-secondary" href={`/api/discussions/${room.id}?format=markdown`}>Export notes</a><a className="btn btn-secondary" href={`/api/discussions/${room.id}?format=json`}>Export JSON</a>
        </div>
        <details><summary className="cursor-pointer choice-target text-meta">Setup and participant evidence</summary><p className="mt-3 whitespace-pre-wrap text-meta break-words">{room.context || 'No additional evidence supplied.'}</p>{room.participants.map(p => <details key={p.id} className="mt-3"><summary className="cursor-pointer choice-target font-semibold">{p.name}</summary><pre className="whitespace-pre-wrap break-words text-meta mt-2">{p.brief}</pre></details>)}</details>
      </section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="min-w-0 space-y-5">
          <section className="rounded-card border border-line bg-surface p-5 space-y-3">
            <h2 className="font-display text-section font-bold">{result?.label}</h2>
            {result?.kind === 'vote' && <><p className="text-meta text-muted">{result.cast}/{result.total} synthetic ballots · {result.abstentions} abstentions. A sole leader is a plurality, not necessarily a majority.</p><ul className="space-y-2">{result.counts?.map(o => <li key={o.id} className="flex justify-between gap-3"><span className="break-words min-w-0">{o.label}</span><strong>{o.count}</strong></li>)}</ul></>}
            {result?.kind === 'consensus' && <p className="text-meta">{result.agreed} agree · {result.objections} object · {result.abstentions} abstain · {result.cast}/{result.total} ballots</p>}
            {room.messages.some(m=>m.kind === 'ballot') && <div className="space-y-3"><h3 className="font-semibold">Individual ballots and reasons</h3>{room.messages.filter(m=>m.kind === 'ballot').map(m=><details key={m.id}><summary className="choice-target cursor-pointer text-meta break-words">{m.speaker}: {room.options.find(o=>o.id === m.choice)?.label || m.choice}</summary><p className="text-meta whitespace-pre-wrap break-words mt-2">{m.text}</p><button className="choice-target underline text-meta" onClick={()=>showNote(m.id)}>View original note {m.id}</button></details>)}</div>}
            {room.messages.filter(m => m.kind === 'proposal').map(m => <div key={m.id}><h3 className="font-semibold">Proposal put to the room</h3><p className="whitespace-pre-wrap break-words mt-2">{m.text}</p>{m.proposal_qualifications?.length ? <details className="mt-3"><summary className="choice-target cursor-pointer text-meta">Context considered with this proposal</summary><div className="space-y-3 mt-3">{m.proposal_qualifications.map((q,i)=><p className="text-meta whitespace-pre-wrap break-words" key={i}>{q.speaker} ({q.ids.join(", ")}) · {q.label}: {q.text}</p>)}</div></details> : null}{refs(m)}</div>)}
          </section>
          <section className="rounded-card border border-line bg-surface p-5 space-y-3">
            <h2 className="font-display text-section font-bold">Facilitated synthesis</h2><p className="text-meta text-muted">Check this generated interpretation against the computed decision and original notes.</p>
            {synthesis ? <>{synthesis.synthesis ? <div className="space-y-4"><p className="text-meta text-muted">{synthesis.synthesis.decision}</p>{[['approach','Facilitator interpretation'],['agreement',room.mode==='explore' ? 'Shared views' : 'Ballot agreement']].map(([key,title])=><div key={key}><h3 className="font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words mt-2">{synthesis.synthesis!.sections[key]}</p></div>)}<details><summary className="choice-target cursor-pointer font-semibold">Recorded objections and qualifications · {synthesis.synthesis.qualifications.length}</summary><p className="text-meta text-muted my-3">Original positions, concerns, vote conditions, and assumptions remain here even when ballots agree.</p><div className="space-y-4">{synthesis.synthesis.qualifications.map((q,i)=><div key={i} className="text-meta"><p className="font-semibold">{q.speaker} · {q.label}</p><p className="whitespace-pre-wrap break-words mt-1">{q.text}</p><div className="flex flex-wrap gap-2 mt-1">{q.ids.map(id=><button key={id} aria-label={`Jump to note ${id}`} className="choice-target min-w-11 px-2 text-brand-text underline" onClick={()=>showNote(id)}>{id}</button>)}</div></div>)}</div></details>{[['downsides','Strongest downside'],['evidence_gaps','Evidence gaps'],['next_steps','Next steps']].map(([key,title])=><div key={key}><h3 className="font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words mt-2">{synthesis.synthesis!.sections[key]}</p></div>)}</div> : <p className="whitespace-pre-wrap break-words">{synthesis.text}</p>}{refs(synthesis)}</> : <p className="text-muted">The facilitator will synthesize after the dialogue{room.mode === 'explore' ? '' : ' and individual ballots'}. Disagreements remain in the record.</p>}
          </section>
        </aside>
        <section id="discussion-notes" tabIndex={-1} className="min-w-0 space-y-4 scroll-mt-28" aria-label="Recorded notes">
          <h2 className="font-display text-section font-bold">Recorded notes</h2>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block">Search notes<input className="review-field mt-2 w-full" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a claim, reason, or message ID" /></label><label className="block">Speaker<select aria-label="Speaker" className="review-field mt-2 w-full" value={speaker} onChange={e => setSpeaker(e.target.value)}><option value="">All speakers</option>{room.participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="facilitator">Facilitator</option></select></label></div>
          <p className="text-meta text-muted">{searchDiscussion(room,query,speaker).length} matching notes · Search includes dialogue, ballots, and synthesis.</p>
          {searchDiscussion(room,query,speaker).map(m => <article tabIndex={-1} key={m.id} id={`note-${m.id}`} className={`rounded-card border bg-surface p-5 scroll-mt-28 ${highlighted === m.id ? 'border-brand' : 'border-line'}`}>
            <div className="flex flex-wrap gap-2 justify-between"><h3 className="font-semibold">{m.speaker}</h3><span className="text-meta text-muted">{m.id} · {m.kind} · round {m.round}</span></div>
            <p className="whitespace-pre-wrap break-words mt-3">{m.text}</p>
            {m.kind === 'ballot' && <p className="font-semibold text-meta mt-3">Ballot: {room.options.find(o => o.id === m.choice)?.label || m.choice}</p>}
            {refs(m)}
          </article>)}
          {!room.messages.length && <p className="text-muted">Start the room to record independent opening opinions.</p>}
          {room.messages.length > 0 && !searchDiscussion(room,query,speaker).length && <p className="text-muted">No notes match these filters.</p>}
        </section>
      </div>
    </>}
  </div>;
}
