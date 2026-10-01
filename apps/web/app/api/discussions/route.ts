import { NextResponse } from 'next/server';
import { listDiscussions } from '../../../../../lib/discussion-store.mjs';
import { createDiscussionFromRequest, discussionFailure, requireLocalDiscussionRead, requireSameOrigin } from '@lib/discussion.server';
export const dynamic = 'force-dynamic';
export async function GET(request:Request) {
  try {requireLocalDiscussionRead(request.headers);const warnings:string[]=[];const discussions=listDiscussions({onError:warning=>warnings.push(warning)});return NextResponse.json({discussions,warnings});}
  catch(error) { return discussionFailure(error); }
}
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);
    const input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({error:'Discussion input must be an object'}, {status:400});
    return NextResponse.json({discussion:await createDiscussionFromRequest(input)}, {status:201});
  } catch(error) { return discussionFailure(error instanceof SyntaxError ? {status:400,message:'Invalid JSON'} : error); }
}
