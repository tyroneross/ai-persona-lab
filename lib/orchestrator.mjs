/**
 * orchestrator — which orchestrator runs this panel, and what it must settle
 * before a single persona is chosen.
 *
 * The panel workflow already knew how to select lenses. It did not know who was
 * accountable for the outcome. A UI review and a pricing decision want different
 * leads, different definitions of "best outcome", and different people to hand
 * the recommendations to — and none of that is a property of the persona roster.
 *
 * A lane carries five things the roster cannot:
 *
 *   outcome_frame            questions answered BEFORE personas are selected,
 *                            because a panel convened for an unnamed customer
 *                            produces findings nobody can act on
 *   outcome_criteria         what "best outcome" means in this discipline
 *   persona_selection        the technique, not just the count
 *   recommendation_consumers who executes each recommendation, by name
 *   iteration_triggers       when a second round is owed
 *
 * This module is deterministic and makes no model calls: it resolves the lane,
 * composes the persona plan from the existing consultation planner, and emits a
 * plan the LLM host executes. `execution: 'plan-only'` is the contract.
 */
import { readFileSync } from 'node:fs';
import { phrasePresent } from './sources.mjs';
import { planConsultation } from './archetypes.mjs';
import { recommendedGuests } from './guests.mjs';

export const LANE_CATALOG = JSON.parse(readFileSync(new URL('./data/orchestrator-lanes.json', import.meta.url), 'utf8'));

export const FALLBACK_LANE = LANE_CATALOG.lanes.find(l => l.fallback === true)?.id || 'general';

export function listLanes() {
  return LANE_CATALOG.lanes;
}

export function findLane(id) {
  const found = LANE_CATALOG.lanes.find(l => l.id === id);
  if (!found) throw new Error(`Unknown orchestrator lane: ${id}. Known: ${LANE_CATALOG.lanes.map(l => l.id).join(', ')}`);
  return found;
}

/**
 * Resolve the lane for a task. An explicit `lane` always wins — a human who
 * names the discipline is not overruled by a keyword count. Otherwise lanes are
 * scored on how many of their trigger terms the task actually contains, ties
 * break on registry order so the same task always resolves the same way, and a
 * task that matches nothing falls back rather than guessing.
 *
 * `alternatives` is part of the answer, not a debug field: a task that scores 4
 * on product and 3 on strategy is a task where the lead is a judgement call, and
 * hiding the runner-up hides that.
 */
export function resolveLane(task, { lane } = {}) {
  const text = String(task || '');
  if (lane !== undefined && lane !== null && lane !== '' && lane !== true) {
    const chosen = findLane(String(lane));
    return {
      lane: chosen.id,
      title: chosen.title,
      source: 'explicit',
      score: 0,
      matched: [],
      alternatives: scoreLanes(text).filter(s => s.id !== chosen.id && s.score > 0),
    };
  }
  const scored = scoreLanes(text);
  const best = scored[0];
  if (!best || best.score === 0) {
    const fallback = findLane(FALLBACK_LANE);
    return { lane: fallback.id, title: fallback.title, source: 'fallback', score: 0, matched: [], alternatives: [] };
  }
  const chosen = findLane(best.id);
  return {
    lane: chosen.id,
    title: chosen.title,
    source: 'keyword',
    score: best.score,
    matched: best.matched,
    alternatives: scored.slice(1).filter(s => s.score > 0),
  };
}

function scoreLanes(text) {
  return LANE_CATALOG.lanes
    .map((l, index) => {
      const matched = (l.keywords || []).filter(k => phrasePresent(text, k));
      return { id: l.id, title: l.title, score: matched.length, matched, index };
    })
    .filter(s => !findLane(s.id).fallback)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ index, ...rest }) => rest);
}

function runSkeleton(lane, { artifact, project }) {
  const slug = artifact || '<artifact-slug>';
  return {
    freeze: ['persona', 'artifact', 'freeze', '--root', '<repo-root>', '--files', '<relative,paths>', '--output', '<snapshot-dir>'],
    open: ['persona', 'run', 'new', '"<the question this panel judges>"',
      '--artifact', slug, '--label', '"<human label>"', '--version', '<frozen-version>',
      '--personas', '<persona_id,persona_id>', '--level', 'medium',
      ...(project ? ['# project context: ' + project] : [])],
    per_persona: ['persona', 'encounter', 'new', '<persona_id>', '--run', '<run_id>', '--artifact', slug, '--version', '<frozen-version>'],
    close: ['persona', 'run', 'close', '<run_id>', '--synthesis', '<file|->'],
    recommend: ['persona', 'run', 'recommend', '<run_id>', '<packet.json|->'],
    lesson: ['persona', 'run', 'lesson', '<run_id>', '--verdict', 'valuable|mixed|wasted', '--changed', '"<what changed>"'],
    note: `A run refuses to open without --version. Freeze ${lane.id === 'ui-ux-design' ? 'the interface' : 'the artifact'} before any persona sees it.`,
  };
}

function recommendationPacketTemplate(lane) {
  return {
    schema: 'schemas/recommendation-packet.schema.json',
    command: ['persona', 'run', 'recommend', '<run_id>', '<packet.json|->'],
    consumers: lane.recommendation_consumers,
    rule: 'Every recommendation names one consumer and one acceptance check. A recommendation with no named consumer is a note, and notes do not get executed.',
    provenance_rule: 'Carry each recommendation\'s provenance (evidence-grounded or assumption) and its adjudication disposition forward from the findings it rests on. Never promote an assumption to evidence by summarising it.',
  };
}

/**
 * The full orchestration plan for one task. Deterministic and model-free: this
 * is the brief the LLM host executes, not the review itself.
 */
export function planOrchestration(task, {
  lane, artifact, project, count = 5, specialties = [], archetypes = [],
} = {}) {
  if (typeof task !== 'string' || !task.trim()) throw new Error('Orchestration requires a task');
  if (task.length > 400) throw new Error('Orchestration task must be at most 400 characters');
  const resolved = resolveLane(task, { lane });
  const spec = findLane(resolved.lane);
  const selection = spec.persona_selection || {};
  const requested = [...new Set([
    ...(Array.isArray(archetypes) ? archetypes : String(archetypes || '').split(',').filter(Boolean)),
    ...(selection.preferred_archetypes || []),
  ])].filter(id => id !== 'red-team');
  // The lane's preferences are a starting roster, not a quota. Trim to what the
  // requested count can hold, leaving the mandatory red-team seat free.
  const personaPlan = planConsultation(task, {
    specialties, archetypes: requested.slice(0, Math.max(0, count - 1)),
    count, mode: selection.consult_mode || 'consultant', artifact, project,
  });

  return {
    version: '1',
    execution: 'plan-only',
    task,
    lane: {
      id: spec.id,
      title: spec.title,
      orchestrator: spec.orchestrator,
      agent_file: spec.agent_file,
      resolution: { source: resolved.source, score: resolved.score, matched: resolved.matched, alternatives: resolved.alternatives },
    },
    outcome_frame: {
      instruction: 'Answer every question in writing before selecting a single persona. Where the request and artifact cannot answer one, write the assumption you are proceeding on and mark it as an assumption. A panel convened for an unnamed customer produces findings nobody can act on.',
      questions: spec.outcome_frame,
    },
    outcome_criteria: spec.outcome_criteria,
    persona_selection: {
      technique: selection.selection_technique,
      consult_mode: selection.consult_mode || 'consultant',
      required_lenses: selection.required_lenses || ['red-team'],
      preferred_archetypes: selection.preferred_archetypes || [],
      recommended_guest_categories: selection.recommended_guest_categories || [],
    },
    persona_plan: personaPlan,
    recommended_guests: recommendedGuests(task, { categories: selection.recommended_guest_categories || [] }),
    guest_use_note: 'Reviewed principles inform a seat; they never impersonate the guest, never claim the guest endorsed this work, and never establish real user behaviour.',
    run_skeleton: runSkeleton(spec, { artifact, project }),
    measurement: {
      instruction: 'Define these before the first persona pass, and tie each one to a named outcome criterion above.',
      set: ['Task completion', 'Comprehension', 'Friction', 'Trust', 'Risk', 'Business fit'],
      per_persona: ['Primary question', 'Success signal', 'Failure signal', 'Anti-goals', 'Evidence to inspect'],
      outcome_criteria: spec.outcome_criteria,
    },
    recommendation_packet_template: recommendationPacketTemplate(spec),
    iteration_plan: {
      triggers: spec.iteration_triggers,
      procedure: [
        'Decide whether any trigger fired; if none did, say so and stop rather than running a round for symmetry.',
        'Re-freeze the artifact at its new version and open a SECOND run. A round is never an edit of the first run.',
        'Keep recall: a `none` persona is dispatched blind again; any informed pass names the exact prior encounter_ids it was shown.',
        'Compare rounds at the orchestrator level, where both are visible. Never hand a persona its own prior answer.',
        'Record what moved between rounds, and whether it moved because the artifact changed or because the persona was shown an argument.',
      ],
      round: 1,
    },
    documentation_plan: {
      ...spec.documentation,
      order: [
        'persona run close <run_id> --synthesis <file|->',
        'persona run recommend <run_id> <packet.json|->',
        'persona run lesson <run_id> --verdict ... --changed "..."',
        'Write the findings document and link the generated report.md path.',
      ],
    },
    reminder: 'hypothesis, not validation',
  };
}
