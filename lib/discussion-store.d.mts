import type {Discussion,DiscussionInput} from './discussion.mjs';
export function saveNewDiscussion(input:DiscussionInput):Discussion;
export function getDiscussion(id:string):Discussion;
export function listDiscussions(options?:{onError?:(warning:string)=>void}):Discussion[];
export function advanceDiscussion(id:string,revision:number,complete:(packet:{turn:unknown;schema:object;messages:{role:string;content:string}[]},model:string,timeoutMs:number)=>Promise<unknown>,timeoutMs?:number):Promise<Discussion>;
