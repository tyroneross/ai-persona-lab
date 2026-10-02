import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkDecisionQuality,decisionQualityReport} from '../scripts/decision-quality.mjs';

const register=()=>({schema:'build-loop.assumption-register/v1',slug:'execution-choice',rows:[{id:'execution-choice',leverage:'high',assessment:{
  scope:'discussion-execution',capture:'prospective',basis:{kind:'assumption',disclosed:true,evidence:['User request and docs/discussions.md']},
  outcome:'Useful directed replies and preserved dissent',criteria:['Respond to the quoted prior point without inventing observed facts'],execution_profile:'codex:luna-high',
  verification:{status:'passed',evidence:['Actual recorded reply and qualifications'],independent_review:{status:'passed',evidence:['Independent audit of requirement and output']}},
}}]});
const incident=()=>({id:'persona-ollama-assumption-20261001',detected_by:'user',detected_stage:'after-delivery',status:'resolved',evidence:['Original source a2ca701 and user correction'],resolution:['04fcd50 and real host turns'],rework_minutes:null});

test('Consequential choices require a record, disclosed evidence basis and observable outcome criteria',()=>{
  assert.equal(checkDecisionQuality(register(),'preflight').passed,true);
  for(const change of [r=>r.rows=[],r=>delete r.rows[0].assessment,r=>r.rows[0].assessment.basis.disclosed=false,r=>r.rows[0].assessment.basis.kind='context-implies-requirement',r=>r.rows[0].assessment.basis.evidence=[],r=>r.rows[0].assessment.criteria=[],r=>delete r.rows[0].assessment.capture]) {
    const r=register();change(r);assert.equal(checkDecisionQuality(r,'preflight').passed,false);
  }
  assert.throws(()=>checkDecisionQuality(register(),'unknown'),/Phase/);
  const low={schema:'build-loop.assumption-register/v1',rows:[{id:'formatting',leverage:'low'}]};assert.equal(checkDecisionQuality(low,'preflight').passed,true);
});

test('The observed internal-room/local-inference mistake cannot satisfy the current discussion quality floor',()=>{
  // Actual previous provider selection was gpt-oss:20b, with no recorded quality criteria.
  const historical=register();historical.rows[0].assessment.execution_profile='gpt-oss:20b';historical.rows[0].assessment.criteria=[];historical.rows[0].assessment.basis.disclosed=false;
  const failed=checkDecisionQuality(historical,'preflight');assert.equal(failed.passed,false);
  assert.ok(failed.errors.some(e=>e.includes('Luna high or Sonnet high')));assert.ok(failed.errors.some(e=>e.includes('criteria')));assert.ok(failed.errors.some(e=>e.includes('Disclose')));
  for(const profile of ['codex:luna-high','claude:sonnet']) {const r=register();r.rows[0].assessment.execution_profile=profile;assert.equal(checkDecisionQuality(r,'preflight').passed,true);}
  const misclassified=register();misclassified.rows[0].assessment.scope='discussionExecution';assert.equal(checkDecisionQuality(misclassified,'preflight').passed,false);
});

test('Preflight permits an autonomous verification pilot but review rejects mechanical-only or unreviewed closure',()=>{
  const r=register();r.rows[0].assessment.verification={status:'pending',evidence:[]};
  assert.equal(checkDecisionQuality(r,'preflight').passed,true);assert.equal(checkDecisionQuality(r,'review').passed,false);
  r.rows[0].assessment.verification={status:'passed',evidence:['JSON parse and persistence passed']};assert.equal(checkDecisionQuality(r,'review').passed,false);
  assert.equal(checkDecisionQuality(register(),'review').passed,true);
});

test('Incident closure requires correction evidence and preserves unmeasured rework',()=>{
  const r=register();r.rows[0].assessment.incident=incident();assert.equal(checkDecisionQuality(r).passed,true);
  for(const change of [i=>i.status='open',i=>i.resolution=[],i=>i.detected_by='unknown',i=>delete i.detected_stage,i=>i.rework_minutes=12,i=>i.rework_minutes=-1]) {
    const copy=structuredClone(r);change(copy.rows[0].assessment.incident);assert.equal(checkDecisionQuality(copy).passed,false);
  }
  const measured=structuredClone(r);measured.rows[0].assessment.incident.rework_minutes=12;measured.rows[0].assessment.incident.rework_evidence=['Measured timer receipt'];assert.equal(checkDecisionQuality(measured).passed,true);
});

test('Reports deduplicate known incidents, disclose retrospective capture and refuse invented rates or improvement',()=>{
  const r=register();r.rows[0].assessment.capture='retrospective';r.rows[0].assessment.incident=incident();
  const report=decisionQualityReport([r,structuredClone(r)]);assert.equal(report.unique_incidents,1);assert.equal(report.detected_by.user,1);assert.equal(report.detected_stage['after-delivery'],1);
  assert.deepEqual(report.decision_rows,{prospective:0,retrospective:1,unassessed:0});assert.equal(report.measured_rework_minutes,null);assert.equal(report.unmeasured_rework_incidents,1);assert.equal(report.failure_rate,null);assert.equal(report.improvement,null);
  assert.ok(checkDecisionQuality(r,'preflight').warnings.some(w=>w.includes('unverified')));
  const different=structuredClone(r);different.rows[0].assessment.outcome='Conflicting outcome';assert.throws(()=>decisionQualityReport([r,different]),/Conflicting decision/);
  const another=structuredClone(r);another.slug='another-register';assert.equal(decisionQualityReport([r,another]).decision_rows.retrospective,2);
  const conflict=structuredClone(r);conflict.rows[0].assessment.incident.detected_by='self';assert.throws(()=>decisionQualityReport([r,conflict]),/Conflicting/);
  const unproven=structuredClone(r);unproven.rows[0].assessment.incident.resolution=[];assert.throws(()=>decisionQualityReport([unproven]),/correction/);
  const measured=structuredClone(r);measured.rows[0].assessment.incident.rework_minutes=12;measured.rows[0].assessment.incident.rework_evidence=['Timer A'];
  const otherTimer=structuredClone(measured);otherTimer.slug='other-source';otherTimer.rows[0].assessment.incident.rework_evidence=['Timer B'];assert.throws(()=>decisionQualityReport([measured,otherTimer]),/Conflicting incident/);
  assert.throws(()=>decisionQualityReport([{rows:[]}]),/nonempty/);
});

test('Development CLI fails on missing/malformed input and validates review evidence independently of host availability',()=>{
  const dir=mkdtempSync(join(tmpdir(),'persona-decision-test-'));
  try {
    const path=join(dir,'register.json');writeFileSync(path,JSON.stringify(register()));
    const run=args=>spawnSync(process.execPath,['scripts/decision-quality.mjs',...args],{encoding:'utf8',env:{...process.env,PERSONA_DISCUSSION_CODEX_BIN:'/missing',PERSONA_DISCUSSION_CLAUDE_BIN:'/missing'}});
    assert.equal(run(['check',path,'--phase','review']).status,0);
    for(const args of [['check',path,'--phase'],['report',path,'--phase','review'],['check',path,'--unknown'],['check',path,'--phase','review','--phase','review']])assert.equal(run(args).status,2);
    assert.equal(run(['check',join(dir,'missing.json')]).status,2);
    writeFileSync(path,'broken JSON');assert.equal(run(['check',path]).status,2);
    writeFileSync(path,JSON.stringify({schema:'build-loop.assumption-register/v1',rows:[]}));assert.equal(run(['check',path]).status,1);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
