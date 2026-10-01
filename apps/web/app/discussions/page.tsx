import {headers} from 'next/headers';
import {requireLocalDiscussionRead} from '@lib/discussion.server';
import DiscussionWorkspace from '@components/DiscussionWorkspace';
import { filePersonaRepository } from '@lib/persona-repository.server';
import { listDiscussions } from '../../../../lib/discussion-store.mjs';
export const dynamic = 'force-dynamic';
export default async function DiscussionsPage() {
  try {requireLocalDiscussionRead(await headers());}
  catch {return <p>Open discussions using the local loopback app address.</p>;}
  const warnings:string[]=[];const discussions=listDiscussions({onError:warning=>warnings.push(warning)});
  return <DiscussionWorkspace personas={await filePersonaRepository.listPersonas()} discussions={discussions} warnings={warnings} />;
}
