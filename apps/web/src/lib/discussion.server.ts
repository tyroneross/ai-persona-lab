import 'server-only';
import {assertDiscussionHost,assertDiscussionWrite} from '../../../../lib/discussion-http.mjs';
import { NextResponse } from 'next/server';
import { filePersonaRepository } from './persona-repository.server';
import { saveNewDiscussion, advanceDiscussion } from '../../../../lib/discussion-store.mjs';
import {completeLocalDiscussion} from '../../../../lib/discussion-ollama.mjs';
import { discussionError, localDiscussionModelNames } from '../../../../lib/discussion.mjs';
import { resolveLennySelections, lennySelectionBrief, type LennySelection } from '../../../../lib/lenny-catalog.mjs';

function endpoint() {
  const url = new URL(process.env.PERSONA_DISCUSSION_OLLAMA_URL || 'http://127.0.0.1:11434');
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Discussion model endpoint must be a local HTTP Ollama server');
  return url.origin;
}
export async function discussionModels() {
  try {
    const response = await fetch(`${endpoint()}/api/tags`, {signal:AbortSignal.timeout(3000), cache:'no-store'});
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    const models = localDiscussionModelNames(data);
    return {models, default_model: process.env.PERSONA_DISCUSSION_MODEL || (['gpt-oss:20b','qwen3:8b-q4_K_M','qwen2.5-coder:7b'].find(name=>models.includes(name)) || models[0] || ''), error:null};
  } catch {
    return {models:[] as string[], default_model:process.env.PERSONA_DISCUSSION_MODEL || '', error:'Local Ollama is unavailable. Start it and install a chat model, then refresh. Saved rooms remain available.'};
  }
}
export const requireSameOrigin = assertDiscussionWrite;
export function requireLocalDiscussionRead(headers:Pick<Headers,'get'>) {assertDiscussionHost(headers.get('host'));}
export function discussionFailure(error: unknown) {
  const err = error as {status?:number;message?:string};
  return NextResponse.json({error:err.message || 'Discussion failed'}, {status:err.status || 500});
}
export async function createDiscussionFromRequest(input: Record<string, unknown>) {
  const ids = input.persona_ids ?? [];
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw discussionError('persona_ids must be an array of IDs');
  if (new Set(ids).size !== ids.length) throw discussionError('Duplicate persona selection');
  const personas = await Promise.all(ids.map(async id => {
    const persona = await filePersonaRepository.getPersona(id);
    if (!persona || persona.status === 'archived') throw discussionError(`Persona unavailable: ${id}`);
    const {id:recordId,status,schema_version,created_at,updated_at,lifespan,recall,...profile}=persona;
    return {id:persona.id, name:persona.name, brief:JSON.stringify(profile,null,2)};
  }));
  const selections = input.lenny_selections ?? [];
  if (!Array.isArray(selections) || selections.some(s => !s || typeof s.role_id !== 'string' || !Array.isArray(s.speaker_ids) || s.speaker_ids.some((id:unknown) => typeof id !== 'string'))) throw discussionError('Invalid Lenny selections');
  let roles;
  try { roles = resolveLennySelections(selections as LennySelection[]); }
  catch (err) { throw discussionError((err as Error).message); }
  const participants = [...personas, ...roles.map(({role,sources}) => ({id:`lenny:${role.id}`, name:`${role.name} lens`, brief: [
    `Synthetic role lens, not ${sources.map(s => s.name).join(' or ') || 'a real guest'} speaking. Responsibility: ${role.primary_question}. Owns ${role.owns}. Excludes ${role.excludes}.`,
    ...lennySelectionBrief([{role_id:role.id, speaker_ids:sources.map(s => s.speaker_id)}]).slice(1).map(line=>line.replace(/ \[lenny:[^\]]+\]/g,'')),
  ].join('\n')}))];
  return saveNewDiscussion({topic:input.topic as string, goal:input.goal as string, context:input.context as string | undefined,
    mode:input.mode as 'explore'|'consensus'|'vote', rounds:input.rounds as number | undefined, options:input.options as string[] | undefined, model:input.model as string, participants});
}
export async function runDiscussionTurn(id:string, revision:number) {
  return advanceDiscussion(id, revision, async (packet, model, timeoutMs) => {
    return completeLocalDiscussion(packet,model,{url:endpoint(),timeoutMs});
  });
}
