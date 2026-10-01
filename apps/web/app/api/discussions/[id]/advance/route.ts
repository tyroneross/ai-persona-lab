import { NextResponse } from 'next/server';
import { discussionFailure, requireSameOrigin, runDiscussionTurn } from '@lib/discussion.server';
export const dynamic = 'force-dynamic';
export async function POST(request:Request, {params}:{params:Promise<{id:string}>}) {
  try {
    requireSameOrigin(request);
    const input = await request.json();
    return NextResponse.json({discussion:await runDiscussionTurn((await params).id, input?.revision)});
  } catch(error) { return discussionFailure(error instanceof SyntaxError ? {status:400,message:'Invalid JSON'} : error); }
}
