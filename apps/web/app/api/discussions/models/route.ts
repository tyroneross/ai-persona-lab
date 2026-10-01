import { NextResponse } from 'next/server';
import { discussionModels, discussionFailure, requireLocalDiscussionRead } from '@lib/discussion.server';
export const dynamic = 'force-dynamic';
export async function GET(request:Request) { try {requireLocalDiscussionRead(request.headers);return NextResponse.json(await discussionModels());} catch(error) {return discussionFailure(error);} }
