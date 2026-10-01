import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,symlinkSync,mkdirSync,unlinkSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDiscussion,localDiscussionModelNames,nextDiscussionTurn,discussionTurnCount,discussionTurnPacket,visibleDiscussionMessages,validateDiscussionResponse,discussionResult,searchDiscussion,discussionMarkdown} from '../lib/discussion.mjs';
import {assertDiscussionHost,assertDiscussionWrite} from '../lib/discussion-http.mjs';
import {saveNewDiscussion,getDiscussion,listDiscussions,advanceDiscussion} from '../lib/discussion-store.mjs';
const input = (mode='explore') => ({topic:'Choose onboarding',goal:'Identify tradeoffs',context:'Users abandon long setup',mode,rounds:2,model:'local-test',options:['Wizard','One page'],participants:[{id:'a',name:'New user',brief:'Needs quick success'},{id:'b',name:'Expert',brief:'Needs detailed control'}]});
function response(room,choice) {
  const turn = nextDiscussionTurn(room), visible = visibleDiscussionMessages(room);
  const refs = turn.kind === 'opening' ? [] : turn.kind === 'reply' ? [discussionTurnPacket(room).schema.properties.engagement.properties.note_id.enum[0]] : turn.kind === 'ballot' && room.mode === 'consensus' ? [visible.find(m => m.kind === 'proposal').id] : visible.map(m => m.id);
  return {assumptions:[],objections:[],conditions:[],...(turn.kind==='reply' ? {engagement:{note_id:refs[0],quote:(visible.find(m=>m.id===refs[0])?.reply?.response || visible.find(m=>m.id===refs[0])?.body || visible.find(m=>m.id===refs[0])?.text || '').split(/(?<=[.!?])\s+/)[0].trim(),response:`In round ${turn.round}, I challenge speed alone because guidance helps beginners`,position:'I retain guided setup pending evidence'}} : {}),...(turn.kind==='ballot' ? {reason:'This choice serves the goal',counterargument:'The opposite option may fit experts'} : {}),...(turn.kind === 'synthesis' ? {sections:Object.fromEntries(['approach','agreement','dissent','downsides','evidence_gaps','next_steps'].filter(key=>key!=='dissent').map(key=>[key,`${key}: synthesis identifies friction and tradeoffs.`]))} : {}),text:`${turn.kind}: ${turn.speaker_id} identifies friction and a tradeoff.`,refs,choice:turn.kind !== 'ballot' ? 'none' : choice || (room.mode === 'vote' ? 'option-1' : 'agree')};
}
function record(room, choice) {room.messages.push(validateDiscussionResponse(room,response(room,choice)));}
for (const mode of ['explore','vote','consensus']) test(`${mode}: ordered discussion with blind openings, equal round visibility, blind ballots, final synthesis`, () => {
  const room = createDiscussion(input(mode),'test');
  const kinds = [];
  while (nextDiscussionTurn(room)) {
    const turn = nextDiscussionTurn(room); kinds.push(turn.kind);
    const visible = visibleDiscussionMessages(room);
    if (turn.kind === 'opening') assert.equal(visible.length,0);
    if (turn.kind === 'reply') assert.ok(visible.every(m => m.round < turn.round));
    if (turn.kind === 'ballot') assert.ok(visible.every(m => m.kind !== 'ballot'));
    assert.equal(discussionTurnPacket(room).turn.kind,turn.kind);
    record(room);
  }
  assert.equal(kinds.length,discussionTurnCount(room));
  assert.equal(kinds.filter(k => k === 'reply').length,4);
  assert.equal(kinds.at(-1),'synthesis');
  assert.equal(discussionResult(room).cast,mode === 'explore' ? 0 : 2);
});
test('Replies must cite another participant; unknown citations and invalid choices fail', () => {
  const room = createDiscussion(input(),'test');record(room);record(room);
  assert.throws(() => validateDiscussionResponse(room,{text:'Agree',refs:['m1'],choice:'none'}),/another participant/);
  assert.throws(() => validateDiscussionResponse(room,{text:'Agree',refs:['m99'],choice:'none'}),/unavailable/);
  assert.throws(() => validateDiscussionResponse(room,{text:'Agree',refs:['m2'],choice:'option-1'}),/invalid ballot/);
  const note = validateDiscussionResponse(room,{...response(room),refs:['m2','m2']}); assert.deepEqual(note.refs,['m2']);
});
test('Consensus requires every individual to agree on the exact proposal; objections and abstentions preserved', () => {
  for (const second of ['object','abstain','agree']) {
    const room = createDiscussion(input('consensus'),'test');
    while(nextDiscussionTurn(room).kind !== 'ballot') record(room);
    assert.throws(() => validateDiscussionResponse(room,{text:'Yes',refs:['m1'],choice:'agree'}),/proposal/);
    record(room,'agree'); assert.equal(discussionResult(room).label,'Consensus pending');
    record(room,second);
    assert.equal(discussionResult(room).label,second === 'agree' ? 'Unanimous agreement' : 'Consensus not reached');
    assert.ok(room.messages.some(m => m.choice === second));record(room);if(second!=='agree')assert.match(room.messages.at(-1).synthesis.sections.approach,/Proposal not approved/);
  }
});
test('Votes distinguish incomplete, plurality, tied and all-abstained results', () => {
  for (const choices of [['option-1','option-2'],['abstain','abstain'],['option-1','abstain']]) {
    const room = createDiscussion(input('vote'),'test');while(nextDiscussionTurn(room).kind !== 'ballot') record(room);
    record(room,choices[0]);assert.equal(discussionResult(room).winner,null);record(room,choices[1]);
    const result=discussionResult(room);assert.equal(result.cast,2);
    assert.equal(result.winner,choices[1] === 'abstain' && choices[0] !== 'abstain' ? 'option-1' : null);
    assert.equal(result.label,choices[0] === 'abstain' ? 'All abstained' : choices[1] === 'option-2' ? 'Tied vote' : 'Plurality: Wizard');record(room);if(!result.winner)assert.match(room.messages.at(-1).synthesis.sections.approach,/No option selected/);
  }
});
test('Creation validates setup and copies participant/option snapshots', () => {
  for (const patch of [{topic:''},{goal:null},{mode:'other'},{rounds:0},{rounds:1.1},{rounds:Number.MAX_SAFE_INTEGER},{participants:[]},{participants:[input().participants[0],{...input().participants[1],name:input().participants[0].name}]},{participants:[input().participants[0],input().participants[0]]},{participants:[{id:'facilitator',name:'x',brief:'y'},input().participants[0]]},{context:[]},{options:['X',' x ']},{mode:'vote',options:['X']}]) assert.throws(() => createDiscussion({...input(),...patch},'test'));
  const data=input();const room=createDiscussion(data,'test');data.participants[0].name='Changed';data.options[0]='Changed';assert.equal(room.participants[0].name,'New user');
});
test('Search covers dissent, ballots and synthesis; export preserves sources, notes and deterministic result', () => {
  const room=createDiscussion(input('vote'),'test');while(nextDiscussionTurn(room)) record(room);
  assert.equal(searchDiscussion(room,'GUIDANCE','b').length,2);
  assert.equal(searchDiscussion(room,'synthesis')[0].kind,'synthesis');
  assert.equal(searchDiscussion(room,'no match').length,0);assert.equal(searchDiscussion(room,'Wizard').length,3);assert.equal(searchDiscussion(room,'none').length,0);
  const markdown=discussionMarkdown(room);assert.match(markdown,/not human preference research/);assert.match(markdown,/Needs quick success/);assert.match(markdown,/References: m/);assert.match(markdown,/Plurality: Wizard/);assert.match(room.messages.at(-1).text,/Wizard: 2/);
});
test('Facilitator must supply all synthesis sections and their contents stay searchable', () => {
  const room=createDiscussion(input(),'test');while(nextDiscussionTurn(room).kind !== 'synthesis')record(room);
  const data=response(room);delete data.sections;assert.throws(()=>validateDiscussionResponse(room,data),/omitted/);
  data.sections={approach:'Only overview'};assert.throws(()=>validateDiscussionResponse(room,data),/required/);
  const structured=response(room);delete structured.text;room.messages.push(validateDiscussionResponse(room,structured));assert.match(room.messages.at(-1).text,/Recorded positions, dissent and qualifications/);assert.match(room.messages.at(-1).text,/Evidence gaps/);
  const disagreement=createDiscussion(input('vote'),'dissent');while(nextDiscussionTurn(disagreement).kind!=='ballot')record(disagreement);const conditional=response(disagreement);conditional.conditions=['Only if novice error rates do not rise'];conditional.assumptions=['Permission setup might require multiple steps'];disagreement.messages.push(validateDiscussionResponse(disagreement,conditional));record(disagreement);record(disagreement);assert.match(disagreement.messages.at(-1).text,/Only if novice error rates do not rise/);assert.match(disagreement.messages.at(-1).text,/Permission setup might require multiple steps/);
  const replying=createDiscussion(input(),'replying');record(replying);record(replying);const invalid=response(replying);delete invalid.engagement;assert.throws(()=>validateDiscussionResponse(replying,invalid),/identify/);const badQuote=response(replying);badQuote.engagement.quote='Made-up source';assert.throws(()=>validateDiscussionResponse(replying,badQuote),/exactly match/);const repeated=response(replying);repeated.engagement.response=replying.messages[0].text;assert.throws(()=>validateDiscussionResponse(replying,repeated),/repeat/);
  const ballots=createDiscussion(input('vote'),'ballots');while(nextDiscussionTurn(ballots).kind!=='ballot')record(ballots);const invalidBallot=response(ballots);delete invalidBallot.counterargument;assert.throws(()=>validateDiscussionResponse(ballots,invalidBallot),/counterargument/);
});
test('Discussion target and Origin guards independently reject rebinding and unsafe writes',()=>{
  for(const host of ['localhost:3000','127.0.0.1:3000','[::1]:3000']) {
    assert.equal(assertDiscussionHost(host).host,host);
    assertDiscussionWrite(new Request(`http://${host}/api/discussions`,{method:'POST',headers:{host,origin:`http://${host}`}}));
    assertDiscussionWrite(new Request(`http://${host}/api/discussions`,{method:'POST',headers:{host,'sec-fetch-site':'same-origin'}}));
  }
  for(const host of [null,'attacker.test','localhost:3000@x','localhost/extra','127.0.0.1:3000#extra']) assert.throws(()=>assertDiscussionHost(host),err=>err.status===403);
  for(const headers of [{host:'attacker.test',origin:'http://attacker.test'},{host:'localhost:3000',origin:'https://evil.test'},{host:'localhost:3000'},{origin:'http://localhost:3000'}]) assert.throws(()=>assertDiscussionWrite(new Request('http://localhost:3000/api/discussions',{method:'POST',headers})),err=>err.status===403);
});
test('Local model selection excludes Ollama cloud aliases and upstream hosts', () => {
  assert.deepEqual(localDiscussionModelNames({models:[{name:'local:7b'},{name:'cloud',remote_model:'cloud-model'},{name:'upstream',remote_host:'https://ollama.com'},{name:null}]}),['local:7b']);
  assert.throws(()=>localDiscussionModelNames({models:null}),/Invalid/);
});
test('Large round counts calculate next turn without allocating a giant schedule', () => {
  const room=createDiscussion({...input(),rounds:1000000000},'test');assert.equal(discussionTurnCount(room),2000000003);assert.equal(nextDiscussionTurn(room).kind,'opening');
});
test('Durable execution, failure/resume, revision conflict, concurrent turn exclusion and stale-result rejection',async () => {
  const temp=mkdtempSync(path.join(os.tmpdir(),'persona-discussion-test-'));const previous=process.env.PERSONA_LAB_HOME;process.env.PERSONA_LAB_HOME=temp;
  try {
    assert.deepEqual(listDiscussions(),[]);const room=saveNewDiscussion(input('vote'));
    const original=JSON.parse(JSON.stringify(room));
    await assert.rejects(advanceDiscussion(room.id,0,async () => {throw new Error('offline');}),/offline/);
    assert.equal(getDiscussion(room.id).status,'error');assert.equal(getDiscussion(room.id).messages.length,0);assert.equal(getDiscussion(room.id).error,'offline');
    await assert.rejects(advanceDiscussion(room.id,0,async()=>({})),/Room changed/);
    await assert.rejects(advanceDiscussion(room.id,getDiscussion(room.id).revision,async()=>({text:'invented ref',refs:['m99'],choice:'none'})),/unavailable/);
    assert.equal(getDiscussion(room.id).messages.length,0);
    let resolveOld;const old=advanceDiscussion(room.id,getDiscussion(room.id).revision,async()=>new Promise(resolve=>{resolveOld=resolve;}));
    const pending=getDiscussion(room.id);assert.equal(pending.status,'running');
    await assert.rejects(advanceDiscussion(room.id,pending.revision,async()=>({})),/already running/);
    const file=path.join(temp,'discussions',`${room.id}.json`);pending.pending.expires_at=Date.now()-1;writeFileSync(file,JSON.stringify(pending));
    const recovered=await advanceDiscussion(room.id,pending.revision,async()=>response(original));assert.equal(recovered.messages.length,1);
    resolveOld(response(original));await assert.rejects(old,/superseded/);
    assert.equal(getDiscussion(room.id).messages.length,1);assert.equal(getDiscussion(room.id).status,'ready');
    while(nextDiscussionTurn(getDiscussion(room.id))) {
      const before=getDiscussion(room.id);
      await advanceDiscussion(room.id,before.revision,async()=>response(before));
    }
    const complete=getDiscussion(room.id);assert.equal(complete.status,'complete');assert.equal(complete.pending,null);assert.equal(complete.error,null);
    await assert.rejects(advanceDiscussion(room.id,complete.revision,async()=>({})),/complete/);
    assert.equal(listDiscussions()[0].id,room.id);
    assert.throws(()=>getDiscussion('../escape'));
    mkdirSync(path.join(temp,'outside'));symlinkSync(path.join(temp,'outside'),path.join(temp,'discussions','linked.json'));
    assert.throws(()=>getDiscussion('linked'),/symlink/);
    writeFileSync(path.join(temp,'discussions','broken.json'),'{invalid');writeFileSync(path.join(temp,'discussions','malformed.json'),'{}');
    const warnings=[];assert.equal(listDiscussions({onError:w=>warnings.push(w)}).length,1);assert.equal(warnings.length,3);
    assert.throws(()=>getDiscussion('.bad'),err=>err.status===400);
    assert.throws(()=>getDiscussion('absent'),err=>err.status===404);
    const corrupt={...complete,error:{bad:'object'}};writeFileSync(file,JSON.stringify(corrupt));assert.throws(()=>getDiscussion(room.id),err=>err.status===422);
    writeFileSync(file,JSON.stringify({...complete,status:'ready',messages:[{...complete.messages[0],speaker_id:'not-selected'}]}));assert.throws(()=>getDiscussion(room.id),err=>err.status===422);
    writeFileSync(file,JSON.stringify(complete));
    const locked=saveNewDiscussion(input());const lock=path.join(temp,'discussions',`${locked.id}.lock`);writeFileSync(lock,'orphan-test');
    await assert.rejects(advanceDiscussion(locked.id,locked.revision,async()=>({})),err=>err.status===503 && /stop all Persona Lab writers/.test(err.message));


  } finally {rmSync(temp,{recursive:true,force:true});if(previous===undefined)delete process.env.PERSONA_LAB_HOME;else process.env.PERSONA_LAB_HOME=previous;}
});

test('Minority, objection and abstention reasons remain in source-preserved synthesis',()=>{
  for(const [mode,choice] of [['consensus','object'],['consensus','abstain'],['vote','option-2'],['vote','abstain']]) {
    const room=createDiscussion(input(mode),'test');while(nextDiscussionTurn(room).kind!=='ballot')record(room);
    record(room);const data=response(room,choice);data.reason='I cannot endorse this without keyboard access evidence';room.messages.push(validateDiscussionResponse(room,data));record(room);
    assert.match(room.messages.at(-1).text,/I cannot endorse this without keyboard access evidence/);assert.ok(room.messages.at(-1).synthesis.qualifications.some(q=>q.label.startsWith('Ballot reason') && q.ids.includes(mode==='consensus' ? 'm9' : 'm8')));
  }
});
test('Completed turns survive brief disk contention without blocking the event loop',async()=>{
  const temp=mkdtempSync(path.join(os.tmpdir(),'persona-discussion-contention-'));const previous=process.env.PERSONA_LAB_HOME;process.env.PERSONA_LAB_HOME=temp;
  try {const room=saveNewDiscussion(input());const lock=path.join(temp,'discussions',room.id+'.lock');let released=false;
    const result=await advanceDiscussion(room.id,0,async()=>{writeFileSync(lock,'other writer');setTimeout(()=>{released=true;unlinkSync(lock);},60);return response(room);});
    assert.equal(released,true);assert.equal(result.messages.length,1);assert.equal(getDiscussion(room.id).status,'ready');
  } finally {if(previous===undefined)delete process.env.PERSONA_LAB_HOME;else process.env.PERSONA_LAB_HOME=previous;rmSync(temp,{recursive:true,force:true});}
});

test('Later ballot packets cannot leak earlier ballots through qualifications or transcript',()=>{
  for(const mode of ['consensus','vote']) {const room=createDiscussion(input(mode),'test');while(nextDiscussionTurn(room).kind!=='ballot')record(room);const first=response(room);first.reason='SECRET_BALLOT_REASON';first.conditions=['SECRET_BALLOT_CONDITION'];room.messages.push(validateDiscussionResponse(room,first));const packet=discussionTurnPacket(room);assert.doesNotMatch(JSON.stringify(packet),/SECRET_BALLOT/);assert.ok(!JSON.parse(packet.messages[1].content).recorded_qualifications.some(q=>q.ids.includes(room.messages.at(-1).id)));}
});

test('Multi-person reply targets rotate and quote candidates bind to the designated source',()=>{
  const room=createDiscussion({...input(),participants:[...input().participants,{id:'c',name:'Buyer',brief:'Needs measurable value'}]},'test');
  while(nextDiscussionTurn(room).kind==='opening')record(room);const first=discussionTurnPacket(room).schema.properties.engagement.properties;assert.deepEqual(first.note_id.enum,['m2']);assert.ok(first.quote.enum.every(q=>q.includes('opening: b')));
  for(let i=0;i<3;i++)record(room);const second=discussionTurnPacket(room).schema.properties.engagement.properties;assert.deepEqual(second.note_id.enum,['m6']);
});

test('Every participant receives one directed reply in each round of a larger group',()=>{
  const room=createDiscussion({...input(),participants:[...input().participants,{id:'c',name:'Buyer',brief:'Needs value'},{id:'d',name:'Designer',brief:'Needs accessible flow'}]},'test');while(nextDiscussionTurn(room).kind==='opening')record(room);
  for(let round=1;round<=2;round++) {const targets=[];for(let i=0;i<4;i++){targets.push(discussionTurnPacket(room).schema.properties.engagement.properties.note_id.enum[0]);record(room);}assert.equal(new Set(targets).size,4);}
});
