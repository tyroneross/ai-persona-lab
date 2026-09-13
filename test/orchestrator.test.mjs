/**
 * The orchestrator lane contract.
 *
 * Two properties carry the feature and both are easy to lose silently:
 * lane resolution must be DETERMINISTIC (the same task must not resolve
 * differently between runs, or two agents reading the same brief get different
 * orchestrators), and every lane must keep a real agent file on disk (a lane
 * that names a missing agent routes work into nothing).
 *
 * All tests use a temp PERSONA_LAB_HOME — never the user's real library.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LANE_CATALOG, listLanes, findLane, resolveLane, planOrchestration } from '../lib/orchestrator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'bin/persona.mjs');

function withTempHome(fn) {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(tmpdir(), 'persona-orchestrator-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    return fn(home);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

test('every lane carries the fields an orchestrator needs before it picks a persona', () => {
  const seen = new Set();
  for (const lane of listLanes()) {
    assert.ok(!seen.has(lane.id), `duplicate lane id ${lane.id}`);
    seen.add(lane.id);
    assert.ok(lane.title && lane.orchestrator, `${lane.id} must name who is accountable`);
    assert.ok(lane.outcome_frame.length >= 4, `${lane.id} outcome_frame must ask at least four questions`);
    assert.ok(lane.outcome_criteria.length >= 3, `${lane.id} must define what best outcome means`);
    assert.ok(lane.persona_selection.selection_technique.length > 80, `${lane.id} needs a selection technique, not a label`);
    assert.ok(lane.persona_selection.required_lenses.includes('red-team'), `${lane.id} must require the red-team lens`);
    assert.ok(lane.recommendation_consumers.length >= 1, `${lane.id} must name who executes its recommendations`);
    for (const consumer of lane.recommendation_consumers) {
      assert.ok(['agent', 'skill', 'human'].includes(consumer.kind), `${lane.id} consumer kind`);
      assert.ok(consumer.name && consumer.receives, `${lane.id} consumer must say what it receives`);
    }
    assert.ok(lane.iteration_triggers.length >= 3, `${lane.id} must say when a second round is owed`);
    assert.ok(lane.documentation.synthesis && lane.documentation.lesson, `${lane.id} must say what to document`);
  }
  assert.equal(listLanes().filter((l) => l.fallback === true).length, 1, 'exactly one fallback lane');
});

test('lane resolution is deterministic, keyword-driven, and falls back rather than guessing', () => {
  const cases = [
    ['Redesign the onboarding screen so a new user reaches first value', 'ui-ux-design'],
    ['Prioritize the roadmap around retention for next quarter', 'product'],
    ['Should we enter the adjacent market or defend our current moat', 'strategy'],
    ['Review the database migration and the new api schema', 'engineering'],
    ['Rewrite the landing page copy for the launch campaign', 'marketing'],
    ['Help me think about the thing we discussed', 'general'],
  ];
  for (const [task, expected] of cases) {
    const first = resolveLane(task);
    const second = resolveLane(task);
    assert.equal(first.lane, expected, task);
    assert.deepEqual(first, second, 'the same task must resolve identically every time');
  }
  const fallback = resolveLane('Help me think about the thing we discussed');
  assert.equal(fallback.source, 'fallback');
  assert.equal(fallback.score, 0);
});

test('an explicit lane overrides keyword scoring and still reports what else matched', () => {
  const forced = resolveLane('Review the database migration and the new api schema', { lane: 'product' });
  assert.equal(forced.lane, 'product');
  assert.equal(forced.source, 'explicit');
  assert.ok(forced.alternatives.some((a) => a.id === 'engineering' && a.score > 0),
    'a human override must still see the lane it overruled');
  assert.throws(() => resolveLane('anything', { lane: 'not-a-lane' }), /Unknown orchestrator lane/);
});

test('a tie between lanes breaks on registry order, not on object iteration luck', () => {
  // "spec" is a product trigger and "api" is an engineering one; a one-all tie
  // must resolve to whichever lane the registry lists first, every time.
  const task = 'Write the spec for the api';
  const registryOrder = LANE_CATALOG.lanes.map((l) => l.id);
  const resolved = resolveLane(task);
  const tied = resolved.alternatives.filter((a) => a.score === resolved.score).map((a) => a.id);
  for (const other of tied) {
    assert.ok(registryOrder.indexOf(resolved.lane) < registryOrder.indexOf(other),
      `${resolved.lane} must precede ${other} in the registry to win the tie`);
  }
  assert.deepEqual(resolveLane(task), resolved);
});

test('the plan is plan-only, keeps the red-team seat, and inherits the lane it resolved to', () => {
  withTempHome(() => {
    const plan = planOrchestration('Redesign the onboarding screen for a first-time user');
    assert.equal(plan.execution, 'plan-only');
    assert.equal(plan.reminder, 'hypothesis, not validation');
    assert.equal(plan.lane.id, 'ui-ux-design');
    assert.equal(plan.persona_plan.mode, 'ui-ux', 'the lane chooses the consultation mode');
    assert.ok(plan.persona_plan.assignments.some((a) => a.archetype_id === 'red-team'),
      'red-team is required in every panel');
    assert.ok(plan.outcome_frame.questions.length >= 4);
    assert.ok(plan.outcome_criteria.length >= 3);
    assert.ok(plan.recommendation_packet_template.consumers.length >= 1);
    assert.ok(plan.iteration_plan.triggers.length >= 3);
    assert.ok(plan.run_skeleton.open.includes('--version'), 'the skeleton must carry the freeze rule');
    assert.throws(() => planOrchestration(''), /Orchestration requires a task/);
    assert.throws(() => planOrchestration('x'.repeat(401)), /at most 400 characters/);
  });
});

test('the lane roster never crowds out the mandatory red-team seat at the minimum count', () => {
  withTempHome(() => {
    // ui-ux prefers five archetypes; at count 3 only two may be seated.
    const plan = planOrchestration('Redesign the onboarding screen', { count: 3 });
    assert.equal(plan.persona_plan.assignments.length, 3);
    assert.equal(plan.persona_plan.assignments.at(-1).archetype_id, 'red-team');
  });
});

test('CLI orchestrate round-trips as JSON and lists lanes', () => {
  withTempHome((home) => {
    const env = { ...process.env, PERSONA_LAB_HOME: home };
    const plan = JSON.parse(execFileSync('node', [cli, 'orchestrate', 'Review the api schema migration', '--json'], { env, encoding: 'utf8' }));
    assert.equal(plan.lane.id, 'engineering');
    assert.equal(plan.execution, 'plan-only');
    assert.ok(Array.isArray(plan.recommended_guests));

    const forced = JSON.parse(execFileSync('node', [cli, 'orchestrate', 'Review the api schema migration', '--lane', 'strategy', '--json'], { env, encoding: 'utf8' }));
    assert.equal(forced.lane.id, 'strategy');
    assert.equal(forced.lane.resolution.source, 'explicit');

    const lanes = JSON.parse(execFileSync('node', [cli, 'orchestrate', 'lanes', '--json'], { env, encoding: 'utf8' }));
    assert.deepEqual(lanes.lanes.map((l) => l.id), listLanes().map((l) => l.id));

    const human = execFileSync('node', [cli, 'orchestrate', 'Redesign the onboarding screen'], { env, encoding: 'utf8' });
    assert.match(human, /Answer these before selecting a single persona/);
    assert.match(human, /Recommendation consumers/);
    assert.match(human, /hypothesis, not validation/);
  });
});

test('every lane points at an agent file that exists on disk', () => {
  for (const lane of listLanes()) {
    assert.ok(lane.agent_file, `${lane.id} must name an agent file`);
    assert.ok(existsSync(path.join(root, lane.agent_file)), `${lane.id} names a missing agent: ${lane.agent_file}`);
  }
});

test('every generated lane agent on disk matches what the generator would write now', async () => {
  const { renderLaneAgent, GENERATED_LANES } = await import('../scripts/sync-orchestrator-agents.mjs');
  const { readFileSync } = await import('node:fs');
  assert.ok(GENERATED_LANES.length >= 5, 'generation must cover every non-fallback lane');
  for (const lane of GENERATED_LANES) {
    const onDisk = readFileSync(path.join(root, lane.agent_file), 'utf8');
    assert.equal(onDisk, renderLaneAgent(lane),
      `${lane.agent_file} has drifted from lib/data/orchestrator-lanes.json — run node scripts/sync-orchestrator-agents.mjs`);
  }
  // The fallback lane's agent is hand-written on purpose: it routes, it does not
  // describe one discipline, so it is not generated and must not be.
  assert.equal(findLane('general').agent_file, 'agents/persona-panel-orchestrator.md');
  assert.ok(!GENERATED_LANES.some((l) => l.id === 'general'));
});

test('every orchestrator agent references the shared protocol rather than restating it', async () => {
  const { readFileSync } = await import('node:fs');
  const protocol = 'skills/persona-lab/references/orchestrator-protocol.md';
  assert.ok(existsSync(path.join(root, protocol)), 'the shared protocol must exist');
  for (const lane of listLanes()) {
    const body = readFileSync(path.join(root, lane.agent_file), 'utf8');
    assert.match(body, /^---\nname: /, `${lane.agent_file} needs agent frontmatter`);
    assert.match(body, /^description: .+/m, `${lane.agent_file} needs a trigger-oriented description`);
    assert.ok(body.includes('orchestrator-protocol.md'), `${lane.agent_file} must reference ${protocol}`);
    assert.ok(body.includes('hypothesis, not validation'), `${lane.agent_file} must carry the stamp`);
  }
});
