import "server-only";

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { PersonaCreateInput } from "./persona";
import { normalizePersonaInput } from "./persona-validation";

const execFileAsync = promisify(execFile);

/**
 * Generate a persona from a free-text instruction. Delegates real generation to
 * the RossLabs Agent Harness (`harness complete --schema`, local model, no API
 * key). Falls back to a deterministic scaffold if the harness is unavailable or
 * returns unusable output, so the feature never hard-fails.
 */

export type GenerateResult = {
  persona: PersonaCreateInput;
  source: string; // e.g. "harness:qwen2.5-coder:7b" or "scaffold"
  note?: string;
};

const DEFAULT_HARNESS_PATHS = [
  path.join(os.homedir(), "dev/git-folder/rosslabs-agent-harness/target/release/harness"),
];

function harnessBin(): string {
  if (process.env.HARNESS_BIN) return process.env.HARNESS_BIN;
  for (const p of DEFAULT_HARNESS_PATHS) if (existsSync(p)) return p;
  return "harness"; // hope it's on PATH
}

const GEN_MODEL = process.env.HARNESS_MODEL || "qwen2.5-coder:7b";

// Bare JSON Schema the model fills. Kept focused so small local models comply.
const PERSONA_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    archetype: { type: "string" },
    role: { type: "string" },
    summary: { type: "string" },
    primary_goal: { type: "string" },
    job_to_be_done: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
    frustrations: { type: "array", items: { type: "string" } },
    motivations: { type: "array", items: { type: "string" } },
    behaviors: { type: "array", items: { type: "string" } },
    needs: { type: "array", items: { type: "string" } },
    anti_goals: { type: "array", items: { type: "string" } },
    quote: { type: "string" },
  },
  required: [
    "name",
    "archetype",
    "role",
    "summary",
    "primary_goal",
    "job_to_be_done",
    "goals",
    "frustrations",
    "motivations",
    "behaviors",
    "needs",
    "anti_goals",
  ],
};

const SYSTEM_PROMPT = [
  "You design a single AI user persona for product/UX review.",
  "Output ONE JSON object matching the schema. No prose, no markdown fences.",
  "Base the persona on goals, behaviors, frustrations, and a job-to-be-done, not demographics.",
  "summary must be a full sentence of at least 40 characters.",
  "job_to_be_done uses: When [situation], I want to [motivation], so I can [outcome].",
  "anti_goals are what would make this persona abandon or distrust the product.",
  "Each list has 2-4 concrete, specific items. This is a synthetic hypothesis, not a real user.",
].join(" ");

function stripFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  // Otherwise take the outermost {...}
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  return first !== -1 && last > first ? t.slice(first, last + 1) : t;
}

function syntheticEvidence(instruction: string) {
  return [
    {
      source_type: "synthetic" as const,
      summary: `Synthetic persona generated from the instruction: "${instruction.slice(0, 200)}". Not grounded in real user data.`,
      confidence: 0.4,
    },
  ];
}

/** Deterministic scaffold — no LLM. Infers a lens and seeds an editable persona. */
export function scaffoldFromInstruction(instruction: string): PersonaCreateInput {
  const text = instruction.toLowerCase();
  const lenses: { match: RegExp; archetype: string; role: string }[] = [
    { match: /security|privacy|admin|compliance|audit/, archetype: "Security-conscious operator", role: "Security or privacy reviewer" },
    { match: /buyer|pricing|budget|procure|roi|enterprise/, archetype: "Budget-holding buyer", role: "Decision-maker / buyer" },
    { match: /new|novice|first|onboarding|beginner/, archetype: "First-run user", role: "Novice / first-run user" },
    { match: /power|expert|advanced|pro\b/, archetype: "Power user", role: "Power user / expert" },
    { match: /accessib|a11y|screen reader|keyboard|disab/, archetype: "Accessibility-focused user", role: "Accessibility / constraint-bound user" },
    { match: /developer|api|sdk|devtool/, archetype: "Developer", role: "Developer platform user" },
  ];
  const hit = lenses.find((l) => l.match.test(text));
  const archetype = hit?.archetype ?? "Skeptical target user";
  const role = hit?.role ?? "Target user";

  return normalizePersonaInput({
    status: "draft",
    name: "",
    archetype,
    role,
    summary: `A ${archetype.toLowerCase()} evaluating: ${instruction.slice(0, 300)}`,
    primary_goal: "",
    job_to_be_done: "When [situation], I want to [motivation], so I can [outcome].",
    goals: [],
    frustrations: [],
    motivations: [],
    behaviors: [],
    needs: [],
    anti_goals: [],
    provenance: "synthetic-assumed",
    scenarios: [{ title: "", description: "" }],
    evidence: syntheticEvidence(instruction),
    confidence: 0.4,
    tags: [],
  });
}

async function generateViaHarness(instruction: string): Promise<PersonaCreateInput> {
  const bin = harnessBin();
  const { stdout } = await execFileAsync(
    bin,
    [
      "complete",
      instruction,
      "--model",
      GEN_MODEL,
      "--system",
      SYSTEM_PROMPT,
      "--schema",
      JSON.stringify(PERSONA_SCHEMA),
    ],
    { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  );

  const raw = JSON.parse(stripFences(stdout)) as Record<string, unknown>;
  // Fold the model output into a valid create input; force synthetic provenance.
  return normalizePersonaInput({
    ...raw,
    status: "draft",
    provenance: "synthetic-assumed",
    scenarios:
      Array.isArray(raw.scenarios) && raw.scenarios.length
        ? raw.scenarios
        : [{ title: "", description: "" }],
    evidence: syntheticEvidence(instruction),
    confidence: 0.4,
  });
}

export async function generatePersona(instruction: string): Promise<GenerateResult> {
  const trimmed = instruction.trim();
  if (trimmed.length < 4) {
    throw new Error("Instruction is too short — describe the persona you want.");
  }
  try {
    const persona = await generateViaHarness(trimmed);
    return { persona, source: `harness:${GEN_MODEL}` };
  } catch (error) {
    return {
      persona: scaffoldFromInstruction(trimmed),
      source: "scaffold",
      note:
        error instanceof Error
          ? `Local generation unavailable (${error.message}); prefilled a scaffold to edit.`
          : "Local generation unavailable; prefilled a scaffold to edit.",
    };
  }
}
