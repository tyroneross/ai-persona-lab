import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync,openSync,closeSync,fsyncSync,unlinkSync} from 'node:fs';
import {safeStorePath} from './store-path.mjs';
import {assertIdSegment} from './idpath.mjs';
import {withStoreLock} from './store-lock.mjs';
import {createDiscussion, discussionError, nextDiscussionTurn, discussionTurnPacket, validateDiscussionResponse,discussionTurnCount,visibleDiscussionMessages} from './discussion.mjs';

function fileFor(id) {
  try {assertIdSegment('discussion ID', id);}
  catch {throw discussionError('Invalid discussion ID',400);}
  return safeStorePath('discussions', `${id}.json`);
}
function write(room) {
  const file = fileFor(room.id);
  const temp = safeStorePath('discussions', `${room.id}-${randomUUID()}.tmp`);
  let fd;
  try {
    fd=openSync(temp,'wx',0o600);
    writeFileSync(fd,JSON.stringify(room,null,2)+'\n');fsyncSync(fd);
    closeSync(fd);fd=undefined;renameSync(temp,file);
    const dir=openSync(safeStorePath('discussions'),'r');
    try {fsyncSync(dir);} finally {closeSync(dir);}
    return room;
  } finally {
    try {if(fd!==undefined)closeSync(fd);}
    finally {try {unlinkSync(temp);} catch(err) {if(err.code!=='ENOENT')throw err;}}
  }
}
function transaction(id, work) {
  fileFor(id);
  const lock = safeStorePath('discussions', `${id}.lock`);
  try {return withStoreLock(lock, () => work(getDiscussion(id)),0);}
  catch(err) {if (err.message.startsWith('store is busy;')) throw discussionError(`Discussion disk transaction is locked: ${lock}. Retry after its writer finishes. If the writer crashed, stop all Persona Lab writers before removing this lock.`,503);throw err;}
}
async function finishTransaction(id,work) {
  const deadline=Date.now()+3000;
  for (;;) {try {return transaction(id,work);} catch(err) {if(err.status!==503 || Date.now()>=deadline)throw err;await delay(25);}}
}
export function saveNewDiscussion(input) {
  const room = createDiscussion(input, randomUUID());
  mkdirSync(safeStorePath('discussions'), {recursive:true});
  return write(room);
}
export function getDiscussion(id) {
  const file=fileFor(id);
  try {
    const room = JSON.parse(readFileSync(file, 'utf8'));
    if (!room || room.version !== 1 || room.id !== id || !Number.isSafeInteger(room.revision) || room.revision < 0 || !Array.isArray(room.options) || !Array.isArray(room.messages) || typeof room.created_at !== 'string' || typeof room.updated_at !== 'string' || !(room.error === null || typeof room.error === 'string') || !['ready','running','error','complete'].includes(room.status) || (room.pending !== null && (!room.pending || typeof room.pending.token !== 'string' || !Number.isFinite(room.pending.expires_at)))) throw new Error('Invalid discussion record');
    const normalized=createDiscussion({...room, options:room.options.map(o => o.label)},id);
    if (JSON.stringify(room.options)!==JSON.stringify(normalized.options) || room.messages.length>discussionTurnCount(room) || (room.status==='running')!==(room.pending!==null) || (room.status==='complete')!==(room.messages.length===discussionTurnCount(room))) throw new Error('Invalid discussion state');

    if (room.messages.some(m => !m || typeof m.id !== 'string' || typeof m.text !== 'string' || typeof m.speaker !== 'string' || !Array.isArray(m.refs) || m.refs.some(ref=>typeof ref !== 'string') || typeof m.choice !== 'string')) throw new Error('Invalid discussion notes');
    for (let i=0;i<room.messages.length;i++) {
      const prefix={...room,messages:room.messages.slice(0,i)},expected=nextDiscussionTurn(prefix),m=room.messages[i];
      const visible=visibleDiscussionMessages(prefix,expected);
      for(const key of ['assumptions','objections','conditions']) if(m[key]!==undefined && (!Array.isArray(m[key]) || m[key].some(text=>typeof text!=='string' || !text.trim()))) throw new Error('Invalid discussion qualifications');
      for(const key of ['body','reason','counterargument']) if(m[key]!==undefined && (typeof m[key]!=='string' || !m[key].trim()))throw new Error('Invalid discussion text fields');
      if(m.proposal_qualifications!==undefined && (!Array.isArray(m.proposal_qualifications) || m.proposal_qualifications.some(q=>!q || !['id','speaker','label','text'].every(key=>typeof q[key]==='string') || !Array.isArray(q.ids) || q.ids.some(id=>typeof id!=='string'))))throw new Error('Invalid proposal context');
      if(m.synthesis && (typeof m.synthesis!=='object' || typeof m.synthesis.decision!=='string' || !m.synthesis.sections || !['approach','agreement','downsides','evidence_gaps','next_steps'].every(key=>typeof m.synthesis.sections[key]==='string') || Object.values(m.synthesis.sections).some(text=>typeof text!=='string') || !Array.isArray(m.synthesis.qualifications) || m.synthesis.qualifications.some(q=>!q || !['id','speaker','label','text'].every(key=>typeof q[key]==='string') || !Array.isArray(q.ids) || q.ids.some(id=>typeof id!=='string')))) throw new Error('Invalid discussion synthesis');
      if(m.reply && (typeof m.reply!=='object' || Array.isArray(m.reply) || !['note_id','response','position'].every(key=>typeof m.reply[key]==='string') || !(typeof m.reply.quote==='string' || typeof m.reply.point==='string'))) throw new Error('Invalid discussion reply');
      const choices=m.kind==='ballot' ? room.mode==='consensus' ? ['agree','object','abstain'] : [...room.options.map(o=>o.id),'abstain'] : ['none'];
      if (m.id!==`m${i+1}` || m.kind!==expected.kind || m.round!==expected.round || m.speaker_id!==expected.speaker_id || m.model!==room.model || m.speaker!==(m.speaker_id==='facilitator' ? 'Facilitator' : room.participants.find(p=>p.id===m.speaker_id)?.name) || typeof m.created_at!=='string' || !choices.includes(m.choice) || m.refs.some(ref=>!visible.some(note=>note.id===ref))) throw new Error('Invalid discussion transcript order or references');
    }
    return room;
  }
  catch (err) { if (err.code === 'ENOENT') throw discussionError('Discussion not found', 404);if (!err.code) throw discussionError(`Saved discussion file is invalid: ${id}`,422);throw err; }
}
export function listDiscussions({onError = () => {}} = {}) {
  let files;
  try { files = readdirSync(safeStorePath('discussions')); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  return files.filter(f => f.endsWith('.json')).flatMap(f => {
    try {return [getDiscussion(f.slice(0,-5))];}
    catch(err) {onError(`${f}: ${err.message}`);return [];}
  }).sort((a,b) => b.updated_at.localeCompare(a.updated_at));
}
/** Claim one turn under lock; model runs outside lock. Lease enables recovery after server loss. */
export async function advanceDiscussion(id, revision, complete, timeoutMs = 120000) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw discussionError('Revision is required');
  const token = randomUUID();
  const room = transaction(id, current => {
    if (current.revision !== revision) throw discussionError('Room changed; reload before continuing', 409);
    if (current.pending && current.pending.expires_at > Date.now()) throw discussionError('A turn is already running', 409);
    if (!nextDiscussionTurn(current)) throw discussionError('Discussion is complete', 409);
    current.pending = {token, expires_at:Date.now() + timeoutMs + 5000};
    current.revision++; current.status = 'running'; current.error = null;
    current.updated_at = new Date().toISOString();
    return write(current);
  });
  try {
    const result = await complete(discussionTurnPacket(room), room.model, timeoutMs);
    let message;
    try {message=validateDiscussionResponse(room,result);}
    catch(err) {throw discussionError(err.message,502);}
    return await finishTransaction(id, current => {
      if (current.pending?.token !== token) throw discussionError('Turn superseded; reload the room', 409);
      current.messages.push(message); current.pending = null; current.error = null;
      current.revision++; current.status = nextDiscussionTurn(current) ? 'ready' : 'complete';
      current.updated_at = new Date().toISOString();
      return write(current);
    });
  } catch (err) {
    try { await finishTransaction(id, current => {
      if (current.pending?.token !== token) return current;
      current.pending = null; current.revision++; current.status = 'error';
      current.error = err.message || 'Model call failed'; current.updated_at = new Date().toISOString();
      return write(current);
    }); } catch(cleanupError) {
      throw discussionError(`${err.message}; could not save failure status: ${cleanupError.message}. Retry after the turn lease expires.`,err.status || 500);
    }
    throw err;
  }
}
