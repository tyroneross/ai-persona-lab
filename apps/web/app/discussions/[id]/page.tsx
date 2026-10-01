import {headers} from 'next/headers';
import {requireLocalDiscussionRead} from '@lib/discussion.server';
import {notFound} from 'next/navigation';
import DiscussionWorkspace from '@components/DiscussionWorkspace';
import {getDiscussion} from '../../../../../lib/discussion-store.mjs';
export const dynamic = 'force-dynamic';
export default async function DiscussionPage({params}:{params:Promise<{id:string}>}) {
  try {requireLocalDiscussionRead(await headers());}
  catch {return <p>Open discussions using the local loopback app address.</p>;}
  let room;
  try { room = getDiscussion((await params).id); }
  catch (error) { if ((error as {status?:number}).status === 422) return <p>This saved discussion file is invalid. Other rooms remain available from <a className="underline" href="/discussions">Discussions</a>. Restore this room from a valid export or backup.</p>; if ((error as {status?:number}).status === 404 || (error as {status?:number}).status === 400) notFound(); throw error; }
  return <DiscussionWorkspace personas={[]} discussions={[]} initialRoom={room} />;
}
