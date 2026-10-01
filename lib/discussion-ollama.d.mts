import type {discussionTurnPacket} from './discussion.mjs';
export function completeLocalDiscussion(packet:Pick<ReturnType<typeof discussionTurnPacket>,'messages'|'schema'>,model:string,options?:{url?:string;fetch?:typeof globalThis.fetch;timeoutMs?:number}):Promise<unknown>;
