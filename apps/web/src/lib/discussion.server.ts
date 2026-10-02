import 'server-only';
import {assertDiscussionHost,assertDiscussionWrite} from '../../../../lib/discussion-http.mjs';
import { NextResponse } from 'next/server';
import { filePersonaRepository } from './persona-repository.server';
import { saveNewDiscussion, advanceDiscussion, getDiscussion } from '../../../../lib/discussion-store.mjs';
import {completeHostDiscussion,discussionHostProfile,discussionHostProfiles} from '../../../../lib/discussion-host.mjs';
import { discussionError } from '../../../../lib/discussion.mjs';
import { resolveLennySelections, lennySelectionBrief, type LennySelection } from '../../../../lib/lenny-catalog.mjs';

export async function discussionModels() {
  return {models:discussionHostProfiles.map(p=>p.id),profiles:discussionHostProfiles,default_model:'codex:luna-high',error:null};
}
export const requireSameOrigin = assertDiscussionWrite;
export function requireLocalDiscussionRead(headers:Pick<Headers,'get'>) {assertDiscussionHost(headers.get('host'));}
export function discussionFailure(error: unknown) {
  const err = error as {status?:number;message?:string};
  return NextResponse.json({error:err.message || 'Discussion failed'}, {status:err.status || 500});
}
export async function createDiscussionFromRequest(input: Record<string, unknown>) {
  const execution=discussionHostProfile(input.model);
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
    mode:input.mode as 'explore'|'consensus'|'vote', rounds:input.rounds as number | undefined, options:input.options as string[] | undefined, model:execution.id, participants});
}
export async function runDiscussionTurn(id:string, revision:number) {
  discussionHostProfile(getDiscussion(id).model);
  return advanceDiscussion(id, revision, async (packet, model, timeoutMs) => {
    return completeHostDiscussion(packet,model,{timeoutMs});
  });
}
