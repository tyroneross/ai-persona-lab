import {localDiscussionModelNames} from './discussion.mjs';
/** Actual Ollama adapter; tests may inject fetch without altering production execution. */
export async function completeLocalDiscussion(packet,model,{url='http://127.0.0.1:11434',fetch=globalThis.fetch,timeoutMs=120000}={}) {
  const target=new URL(url);
  if(target.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.username || target.password)throw new Error('Discussion model endpoint must be a local HTTP Ollama server');
  url=target.origin;
    const signal=AbortSignal.timeout(timeoutMs);
    const tagsResponse=await fetch(`${url}/api/tags`,{signal,cache:'no-store'});
    if (!tagsResponse.ok || !localDiscussionModelNames(await tagsResponse.json().catch(()=>{throw new Error('Ollama model list returned invalid JSON');})).includes(model)) throw new Error('Choose an installed local model. Cloud/remote Ollama models cannot run this local discussion.');
    const detailsResponse = await fetch(`${url}/api/show`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model}),signal,cache:'no-store'});
    if (!detailsResponse.ok) throw new Error(`Cannot load local model details (${detailsResponse.status}). Choose an installed chat model.`);
    const details = await detailsResponse.json().catch(()=>{throw new Error('Ollama model details returned invalid JSON');});
    if (!Array.isArray(details.capabilities)) throw new Error('This Ollama version does not report model capabilities. Update Ollama to execute discussions.');
    if (!details.capabilities.includes('completion')) throw new Error('Selected model does not support chat completion');
    const contextLimit = Number(Object.entries(details.model_info || {}).find(([key]) => key.endsWith('.context_length'))?.[1]);
    // Byte count is a conservative token upper bound for these local text models,
    // plus the output budget and 256 for chat framing. Do not silently drop old discussion.
    const thinkingValues=details.capabilities.includes('thinking') ? details.thinking?.values || [] : [];
    if(details.capabilities.includes('thinking') && !thinkingValues.some(value=>[false,true,'low','medium','high'].includes(value)))throw new Error('Thinking-capable model does not report supported thinking controls. Update Ollama or choose another model.');
    const thinking=thinkingValues.includes(false) ? false : thinkingValues.includes('low') ? 'low' : thinkingValues.includes('medium') ? 'medium' : thinkingValues.includes('high') ? 'high' : thinkingValues.includes(true) ? true : undefined;
    const outputTokens=details.capabilities.includes('thinking') && thinking!==false ? 4096 : 1024;
    const contextNeeded = Buffer.byteLength(JSON.stringify(packet), 'utf8') + Buffer.byteLength(details.template || '', 'utf8') + Buffer.byteLength(details.system || '', 'utf8') + outputTokens + 256;
    if (!Number.isSafeInteger(contextLimit) || contextLimit < contextNeeded) throw new Error(`Discussion exceeds this model's context budget (${contextNeeded} conservative tokens needed; ${contextLimit || 'unknown'} available). Use a model with more context, fewer source passages, or a shorter discussion.`);
    const response = await fetch(`${url}/api/chat`, {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({model, messages:packet.messages, format:packet.schema, stream:false, ...(thinking!==undefined ? {think:thinking} : {}), options:{num_ctx:Math.min(contextLimit,2 ** Math.ceil(Math.log2(contextNeeded))),num_predict:outputTokens}}),
      signal, cache:'no-store'});
    if (!response.ok) throw new Error(`Local model call failed (${response.status}): ${(await response.text()).slice(0,300)}`);
    const data = await response.json().catch(()=>{throw new Error('Ollama completion returned invalid JSON');});
    if (data.done !== true || data.done_reason === 'length') throw new Error('Model response was incomplete; retry this turn or use a model with more context');
    try { return JSON.parse(data.message.content); }
    catch { throw new Error('Model returned invalid JSON; retry this turn'); }
}
