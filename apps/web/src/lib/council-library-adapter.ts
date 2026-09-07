/**
 * Bridge the shared persona library (~/.persona-lab) into the council model.
 *
 * Councils are the heavier, large-panel concept (a valid roster needs 8+
 * personas for the `high` level); the CLI `persona panel` covers the lighter
 * 3-6 lens critique. This adapter lets a council roster be built from personas
 * that were generated/saved via the CLI or coding agents, without changing the
 * council domain model.
 */

import type { Persona } from "./persona";
import type {
  CouncilType,
  RepoPersonaRosterInput,
  RosterLens,
  RosterPersona,
} from "./council";
import { reviewLevelBounds } from "./council";

const LENS_KEYWORDS: { lens: RosterLens; match: RegExp }[] = [
  { lens: "buyer", match: /buyer|procure|purchas|budget|roi/ },
  { lens: "risk", match: /security|privacy|risk|compliance|audit|legal/ },
  { lens: "design", match: /design|ux|accessibility|a11y|content|copy/ },
  { lens: "engineering", match: /engineer|frontend|platform|developer|devtool/ },
  { lens: "data", match: /data|analy|metric|measur/ },
  { lens: "revenue", match: /sales|revenue|growth|marketing/ },
  { lens: "support", match: /support|success|onboarding|help/ },
  { lens: "executive", match: /strategy|executive|general manager|\bgm\b|portfolio/ },
  { lens: "product", match: /product|roadmap|\bpm\b/ },
  { lens: "operator", match: /operator|admin|ops\b/ },
  { lens: "domain", match: /healthcare|finance|education|clinical|domain/ },
];

/** Map a library persona to a council RosterLens from its role/archetype/tags. */
export function inferLens(persona: Persona): RosterLens {
  const hay = [persona.role, persona.archetype, ...(persona.tags ?? [])]
    .join(" ")
    .toLowerCase();
  for (const { lens, match } of LENS_KEYWORDS) {
    if (match.test(hay)) return lens;
  }
  return "user";
}

/** Convert one library persona into a council RosterPersona (validation-safe). */
export function libraryPersonaToRosterPersona(persona: Persona): RosterPersona {
  const failureModes =
    persona.anti_goals && persona.anti_goals.length > 0
      ? persona.anti_goals
      : persona.frustrations;
  return {
    id: persona.id,
    name: persona.name,
    lens: inferLens(persona),
    role: persona.role,
    job_to_be_done: persona.job_to_be_done?.trim() || persona.primary_goal,
    decision_power: persona.primary_goal,
    failure_modes: failureModes,
    evidence_expectations: persona.needs,
    default_use_cases: ["decision", "ui_test"] as CouncilType[],
  };
}

/** How many library personas are needed before a valid roster can be built. */
export const MIN_LIBRARY_PERSONAS_FOR_ROSTER = reviewLevelBounds.high.min;

function levelSubset(ids: string[], level: "low" | "medium" | "high"): string[] {
  const { min, max } = reviewLevelBounds[level];
  const count = Math.min(Math.max(min, level === "high" ? ids.length : min), max, ids.length);
  return ids.slice(0, count);
}

/**
 * Build a council roster input from library personas. Requires at least
 * MIN_LIBRARY_PERSONAS_FOR_ROSTER personas (the `high` level lower bound).
 */
export function buildRosterInputFromPersonas(
  personas: Persona[],
  opts: { repoPath: string; name?: string },
): RepoPersonaRosterInput {
  if (personas.length < MIN_LIBRARY_PERSONAS_FOR_ROSTER) {
    throw new Error(
      `Need at least ${MIN_LIBRARY_PERSONAS_FOR_ROSTER} saved personas to build a council roster; found ${personas.length}. ` +
        `Generate more with the persona CLI, or use \`persona panel\` for a lighter 3-6 lens critique.`,
    );
  }
  const rosterPersonas = personas.map(libraryPersonaToRosterPersona);
  const ids = rosterPersonas.map((p) => p.id);
  const repoSlug =
    opts.repoPath
      .split("/")
      .filter(Boolean)
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") || "workspace";

  return {
    repo_path: opts.repoPath,
    repo_slug: repoSlug,
    source_summary:
      opts.name?.trim() ||
      `Roster built from ${personas.length} saved personas in the shared library.`,
    personas: rosterPersonas,
    default_levels: {
      low: levelSubset(ids, "low"),
      medium: levelSubset(ids, "medium"),
      high: levelSubset(ids, "high"),
    },
    generated_from: ["persona-library"],
    user_overrides: [],
  };
}
