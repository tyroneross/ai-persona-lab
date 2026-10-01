import test from 'node:test';
import assert from 'node:assert/strict';
import {completeLocalDiscussion} from '../lib/discussion-ollama.mjs';
const packet={messages:[{role:'user',content:'Short evidence'}],schema:{type:'object'}};
const details={capabilities:['completion','thinking'],thinking:{values:['low','medium','high']},model_info:{'test.context_length':32768},template:'chat'};
function fixture(overrides={}) {
  const calls=[];
  const fetch=async(url,init)=>{
    calls.push({url,init});const route=new URL(url).pathname;
    const bodies={'/api/tags':{models:[{name:'chat'}]},'/api/show':details,'/api/chat':{done:true,done_reason:'stop',message:{content:'{"text":"real adapter fixture"}'}}};
    return new Response(overrides[route]===undefined ? JSON.stringify(bodies[route]) : typeof overrides[route]==='string' ? overrides[route] : JSON.stringify(overrides[route]),{status:overrides.status || 200});
  };return {fetch,calls};
}
test('Ollama adapter verifies locality/capabilities, chooses reported controls and sends actual structured chat request',async()=>{
  const f=fixture();assert.deepEqual(await completeLocalDiscussion(packet,'chat',f),{text:'real adapter fixture'});
  const request=JSON.parse(f.calls.at(-1).init.body);assert.equal(request.think,'low');assert.equal(request.stream,false);assert.equal(request.options.num_predict,4096);assert.deepEqual(request.format,packet.schema);assert.ok(f.calls.every(c=>c.init.signal));
  for(const [values,expected,budget] of [[[false,true],false,1024],[['medium','high'],'medium',4096],[[true],true,4096]]) {const item=fixture({'/api/show':{...details,thinking:{values}}});await completeLocalDiscussion(packet,'chat',item);const body=JSON.parse(item.calls.at(-1).init.body);assert.equal(body.think,expected);assert.equal(body.options.num_predict,budget);}
  const plain=fixture({'/api/show':{...details,capabilities:['completion'],thinking:undefined}});await completeLocalDiscussion(packet,'chat',plain);assert.equal(JSON.parse(plain.calls.at(-1).init.body).think,undefined);
  await assert.rejects(completeLocalDiscussion(packet,'chat',{url:'https://remote.test',fetch:f.fetch}),/local HTTP/);
});
test('Ollama adapter rejects remote aliases, missing capabilities, context overflow, truncated output and invalid JSON',async()=>{
  for(const [overrides,error] of [
    [{'/api/tags':{models:[{name:'chat',remote_host:'https://ollama.com'}]}},/installed local/],
    [{'/api/tags':'broken'},/invalid JSON/],
    [{'/api/show':'broken'},/invalid JSON/],
    [{'/api/show':{}},/capabilities/],
    [{'/api/show':{...details,capabilities:['embedding']}},/chat completion/],
    [{'/api/show':{...details,thinking:undefined}},/thinking controls/],
    [{'/api/show':{...details,model_info:{'test.context_length':128}}},/context budget/],
    [{'/api/chat':{done:true,done_reason:'length'}},/incomplete/],
    [{'/api/chat':{done:false}},/incomplete/],
    [{'/api/chat':'broken'},/invalid JSON/],
    [{'/api/chat':{done:true,message:{content:'broken'}}},/invalid JSON/],
    [{status:503},/installed local/],
  ]) await assert.rejects(completeLocalDiscussion(packet,'chat',fixture(overrides)),error);
});
