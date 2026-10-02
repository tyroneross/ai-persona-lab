#!/usr/bin/env node
// Assessment metadata extends the existing Build Loop register; it is not a second store.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {discussionHostProfile} from '../lib/discussion-host.mjs';

const text=value=>typeof value==='string' && Boolean(value.trim());
const evidence=value=>Array.isArray(value) && value.length>0 && value.every(text);
const basisKinds=['user-instruction','repo-fact','assumption'];
const detectorStages=['preflight','review','after-delivery'];
function incidentErrors(incident) {
  const errors=[];
  if(!text(incident.id) || !['user','self','independent-review'].includes(incident.detected_by) || !evidence(incident.evidence))errors.push('Incident needs a stable ID, detector and source evidence');
  if(!detectorStages.includes(incident.detected_stage))errors.push('Record whether detection happened in preflight, review or after delivery');
  if(!['open','resolved'].includes(incident.status))errors.push('Incident status must be open or resolved');
  if(incident.status==='resolved' && !evidence(incident.resolution))errors.push('Resolved incident needs correction and verification references');
  if(incident.rework_minutes!==null && (!Number.isFinite(incident.rework_minutes) || incident.rework_minutes<0 || !evidence(incident.rework_evidence)))errors.push('Rework time must be measured with evidence, or null');
  return errors;
}
export function checkDecisionQuality(register,phase='review') {
  if(!['preflight','review'].includes(phase))throw new Error('Phase must be preflight or review');
  const errors=[],warnings=[];
  if(register?.schema!=='build-loop.assumption-register/v1' || !Array.isArray(register.rows) || !register.rows.length)return {phase,passed:false,errors:['A nonempty Build Loop assumption register is required']};
  for(const row of register.rows) {
    const fail=message=>errors.push(`${row?.id || '(missing ID)'}: ${message}`);
    const a=row?.assessment;
    if(row?.leverage==='low' && !a)continue;
    if(!a || typeof a!=='object') {fail('Consequential decision needs assessment metadata');continue;}
    if(!basisKinds.includes(a.basis?.kind) || !evidence(a.basis?.evidence))fail('Declare the evidence basis: user-instruction, repo-fact, or assumption, with source references');
    if(a.basis?.kind==='assumption' && a.basis.disclosed!==true)fail('Disclose the assumption before treating it as a requirement');
    if(!text(a.outcome) || !evidence(a.criteria))fail('State the intended outcome and observable acceptance criteria');
    if(!['prospective','retrospective'].includes(a.capture))fail('Declare whether capture was prospective or retrospective');
    if(a.capture==='retrospective')warnings.push(`${row.id}: Historical preflight and disclosure timing are unverified; this checks the current record only`);
    if(!text(a.scope))fail('Name the decision scope');
    if(a.execution_profile!==undefined && a.scope!=='discussion-execution')fail('Execution profiles must be classified as discussion-execution');
    if(a.scope==='discussion-execution') {
      try {discussionHostProfile(a.execution_profile);}catch {fail('Discussion execution must use Luna high or Sonnet high');}
    }
    if(phase==='review') {
      if(a.verification?.status!=='passed' || !evidence(a.verification.evidence))fail('Outcome verification must pass with evidence; mechanical checks alone do not establish suitability');
      if(a.verification?.independent_review?.status!=='passed' || !evidence(a.verification.independent_review.evidence))fail('Require an independent decision review with evidence');
    }
    const incident=a.incident;
    if(incident) {
      incidentErrors(incident).forEach(fail);
      if(phase==='review' && incident.status==='open')fail('Known incident remains unresolved');
    }
  }
  return {phase,passed:errors.length===0,errors,warnings};
}

export function decisionQualityReport(registers) {
  let prospective=0,retrospective=0,unassessed=0;
  const incidents=new Map(),decisions=new Map();
  for(const register of registers) {
    if(register?.schema!=='build-loop.assumption-register/v1' || !Array.isArray(register.rows) || !register.rows.length)throw new Error('Report requires nonempty Build Loop registers');
    for(const row of register.rows) {
      if(!text(register.slug) || !text(row?.id))throw new Error('Reports require register slugs and decision IDs');
      const key=JSON.stringify([register.slug,row.id]),rowSignature=JSON.stringify(row);
      if(decisions.has(key)) {
        if(decisions.get(key)!==rowSignature)throw new Error(`Conflicting decision records: ${register.slug}/${row.id}`);
        continue;
      }
      decisions.set(key,rowSignature);
      const a=row?.assessment;
      if(a?.capture==='prospective')prospective++;else if(a?.capture==='retrospective')retrospective++;else unassessed++;
      if(!a?.incident)continue;
      const incident=a.incident;
      const problems=incidentErrors(incident);if(problems.length)throw new Error(problems.join('; '));
      const signature=JSON.stringify({detected_by:incident.detected_by,detected_stage:incident.detected_stage,status:incident.status,rework_minutes:incident.rework_minutes,rework_evidence:incident.rework_evidence,evidence:incident.evidence,resolution:incident.resolution});
      if(incidents.has(incident.id) && incidents.get(incident.id).signature!==signature)throw new Error(`Conflicting incident records: ${incident.id}`);
      incidents.set(incident.id,{...incident,signature});
    }
  }
  const events=[...incidents.values()];
  return {coverage:'recorded decisions only; retrospective capture is selected after the event',
    decision_rows:{prospective,retrospective,unassessed},unique_incidents:events.length,
    detected_by:Object.fromEntries(['user','self','independent-review'].map(who=>[who,events.filter(e=>e.detected_by===who).length])),
    detected_stage:Object.fromEntries(detectorStages.map(stage=>[stage,events.filter(e=>e.detected_stage===stage).length])),
    unresolved:events.filter(e=>e.status==='open').length,
    measured_rework_minutes:events.some(e=>e.rework_minutes!==null) ? events.filter(e=>e.rework_minutes!==null).reduce((sum,e)=>sum+e.rework_minutes,0) : null,
    unmeasured_rework_incidents:events.filter(e=>e.rework_minutes===null).length,
    failure_rate:null,improvement:null,limitation:'No complete opportunity denominator or comparable baseline; counts do not prove reduced failures.'};
}

async function main(args) {
  const [command,...rest]=args;let phase='review';
  const phaseIndex=rest.indexOf('--phase');if(phaseIndex>=0) {
    if(command!=='check' || !['preflight','review'].includes(rest[phaseIndex+1]))throw new Error('--phase requires preflight or review and is only valid for check');
    phase=rest[phaseIndex+1];rest.splice(phaseIndex,2);
  }
  if(rest.some(value=>value.startsWith('--')))throw new Error('Unknown option');
  if(!['check','report'].includes(command) || !rest.length || (command==='check' && rest.length!==1))throw new Error('Usage: decision-quality.mjs check REGISTER [--phase preflight|review] | report REGISTER...');
  const registers=await Promise.all(rest.map(async path=>JSON.parse(await readFile(path,'utf8'))));
  const result=command==='check' ? checkDecisionQuality(registers[0],phase) : decisionQualityReport(registers);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.passed===false)process.exitCode=1;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=2;});
