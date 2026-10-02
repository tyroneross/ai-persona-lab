import type {discussionTurnPacket} from './discussion.mjs';
export type DiscussionHostProfile={id:string;label:string;host:string;model:string;effort:string};
export const discussionHostProfiles:readonly DiscussionHostProfile[];
export function discussionHostProfile(id:unknown):DiscussionHostProfile;
export function completeHostDiscussion(packet:Pick<ReturnType<typeof discussionTurnPacket>,'messages'|'schema'>,model:string,options?:{timeoutMs?:number}):Promise<unknown>;
