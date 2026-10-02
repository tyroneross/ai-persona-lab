import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {discussionHostProfiles,discussionHostProfile,discussionHostCommand,parseDiscussionHostResponse,completeHostDiscussion,runDiscussionHost,discussionHostEnvironment} from '../lib/discussion-host.mjs';

const response={text:'A structured response',refs:[],choice:null};
const sonnet=discussionHostProfile('claude:sonnet');
const luna=discussionHostProfile('codex:luna-high');
const claudeResult=(patch={})=>({code:0,stdout:JSON.stringify({is_error:false,subtype:'success',terminal_reason:'completed',modelUsage:{'claude-sonnet-5-5':{}},structured_output:response,...patch})});
const codexResult=(events=[])=>({code:0,stdout:[{type:'thread.started',thread_id:'fresh'},...events,{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(response)}},{type:'turn.completed'}].map(JSON.stringify).join('\n')});

test('Execution profiles pin Luna high or Sonnet high and reject weak or historical model choices',()=>{
  assert.deepEqual(discussionHostProfiles.map(p=>p.id),['codex:luna-high','claude:sonnet']);
  for(const id of ['qwen3:8b','gpt-oss:20b','claude:haiku','codex:luna-low','',null,undefined])assert.throws(()=>discussionHostProfile(id),/Choose Luna High/);
  const c=discussionHostCommand(luna,'/tmp/isolated','/tmp/schema',{},{});
  assert.equal(c.command,'codex');
  assert.ok(c.args.includes('gpt-6-luna'));assert.ok(c.args.includes('model_reasoning_effort="high"'));
  for(const flag of ['--ignore-user-config','--ignore-rules','--ephemeral','--output-schema','read-only'])assert.ok(c.args.includes(flag));
  assert.ok(!c.args.includes('--oss'));assert.ok(!c.args.includes('resume'));
  const s=discussionHostCommand(sonnet,'/tmp/isolated','/tmp/schema',{type:'object'},{PERSONA_DISCUSSION_CLAUDE_BIN:'/custom/claude'});
  assert.equal(s.command,'/custom/claude');
  assert.equal(s.args[s.args.indexOf('--model')+1],'sonnet');assert.equal(s.args[s.args.indexOf('--effort')+1],'high');
  assert.equal(s.args[s.args.indexOf('--tools')+1],'');assert.ok(s.args.includes('--safe-mode'));assert.ok(s.args.includes('--no-session-persistence'));
  const privateSchema={type:'object',properties:{quote:{type:'string',enum:['Private source quotation']}}};
  const privateCommand=discussionHostCommand(sonnet,'/tmp/isolated','/tmp/schema',privateSchema,{});
  assert.ok(!privateCommand.args.some(arg=>arg.includes('Private source quotation')));
  assert.deepEqual(JSON.parse(privateCommand.args[privateCommand.args.indexOf('--json-schema')+1]),{type:'object',properties:{quote:{type:'string'}}});
});

test('Native host parsing requires completed structured output and rejects errors, downgrade, truncation and tool activity',()=>{
  assert.deepEqual(parseDiscussionHostResponse(sonnet,claudeResult()),response);
  assert.deepEqual(parseDiscussionHostResponse(luna,codexResult([{type:'item.completed',item:{type:'error',message:'Startup diagnostic'}}])),response);
  for(const result of [claudeResult({is_error:true}),claudeResult({terminal_reason:'max_tokens'}),claudeResult({modelUsage:{'claude-haiku-4-5':{}}}),claudeResult({modelUsage:{}}),claudeResult({structured_output:null}),{code:1,stdout:'secret diagnostic'},{code:0,stdout:'broken JSON'}])assert.throws(()=>parseDiscussionHostResponse(sonnet,result));
  for(const result of [codexResult([{type:'turn.failed'}]),codexResult([{type:'item.completed',item:{type:'command_execution'}}]),codexResult([{type:'item.started',item:{type:'mcp_tool_call'}}]),{code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{}'}})}])assert.throws(()=>parseDiscussionHostResponse(luna,result));
});

test('Fresh host turns preserve complete context and clean private schema files on success and failure',async()=>{
  const packet={messages:[{role:'system',content:'Discussion policy'},{role:'user',content:'Evidence $HOME `touch secret`'}],schema:{type:'object'}};
  const directories=[];
  for(const model of ['codex:luna-high','claude:sonnet']) {
    const parsed=await completeHostDiscussion(packet,model,{timeoutMs:3456,env:{},run:async(command,args,options)=>{
      directories.push(options.cwd);assert.equal(options.timeoutMs,3456);assert.deepEqual(JSON.parse(options.input).messages,packet.messages.filter(m=>m.role!=='system'));
      assert.ok(args.some(arg=>arg.includes('Discussion policy')));
      assert.deepEqual(JSON.parse(await readFile(options.cwd+'/response.schema.json','utf8')),packet.schema);
      assert.equal(command,model.startsWith('codex')?'codex':'claude');
      return command==='codex'?codexResult():claudeResult();
    }});
    assert.deepEqual(parsed,response);
  }
  assert.notEqual(directories[0],directories[1]);
  for(const path of directories)await assert.rejects(access(path));
  let failedPath;
  await assert.rejects(completeHostDiscussion(packet,'codex:luna-high',{run:async(_c,_a,o)=>{failedPath=o.cwd;throw new Error('host failed');}}),/host failed/);
  await assert.rejects(access(failedPath));
  let called=false;await assert.rejects(completeHostDiscussion(packet,'weak',{run:async()=>{called=true;}}),/Choose Luna High/);assert.equal(called,false);
});

test('Process runner fails explicitly for missing hosts, nonzero exits and deadlines without leaking diagnostics',async()=>{
  await assert.rejects(runDiscussionHost('/missing-persona-host',[],{cwd:process.cwd(),input:'',timeoutMs:1000}),/Cannot start/);
  const nonzero=await runDiscussionHost(process.execPath,['-e','process.exit(3)'],{cwd:process.cwd(),input:'',timeoutMs:1000});assert.equal(nonzero.code,3);
  await assert.rejects(runDiscussionHost(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:process.cwd(),input:'',timeoutMs:100}),/timed out/);
});

test('Host environment preserves sign-in homes and excludes provider, model and API-key overrides',()=>{
 const env=discussionHostEnvironment({HOME:'/user',PATH:'/bin',CODEX_HOME:'/signed-in-codex',CLAUDE_CONFIG_DIR:'/signed-in-claude',OPENAI_API_KEY:'secret',ANTHROPIC_API_KEY:'secret',OPENAI_BASE_URL:'http://override',ANTHROPIC_BASE_URL:'http://override',ANTHROPIC_DEFAULT_SONNET_MODEL:'haiku',CLAUDE_CODE_EFFORT_LEVEL:'low'});
 assert.deepEqual(env,{PATH:'/bin',HOME:'/user',CODEX_HOME:'/signed-in-codex',CLAUDE_CONFIG_DIR:'/signed-in-claude'});
});
