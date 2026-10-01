import { NextResponse } from 'next/server';
import { getDiscussion } from '../../../../../../lib/discussion-store.mjs';
import { discussionMarkdown } from '../../../../../../lib/discussion.mjs';
import { discussionFailure, requireLocalDiscussionRead } from '@lib/discussion.server';
export const dynamic = 'force-dynamic';
export async function GET(request:Request, {params}:{params:Promise<{id:string}>}) {
  try {
    requireLocalDiscussionRead(request.headers);
    const room = getDiscussion((await params).id);
    const format = new URL(request.url).searchParams.get('format');
    if (format === 'markdown') return new Response(discussionMarkdown(room), {headers:{'content-type':'text/markdown; charset=utf-8','content-disposition':`attachment; filename="discussion-${room.id}.md"`}});
    if (format === 'json') return new Response(JSON.stringify(room,null,2), {headers:{'content-type':'application/json','content-disposition':`attachment; filename="discussion-${room.id}.json"`}});
    return NextResponse.json({discussion:room});
  } catch(error) { return discussionFailure(error); }
}
