import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { safeStorePath } from "./store-path.mjs";
import { readRun } from "./runs.mjs";
import { getPersona } from "./library.mjs";
import { scaffoldEncounter, validateEncounter } from "./encounters.mjs";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const lines = (items = []) => items.map((item) => `- ${item}`).join("\n") || "- None stated";

export function createJourneyPacket({ run_id, persona_id, viewports = ["390x844"], tools = ["computer-use", "screenshot"], budget_minutes = 10 }) {
  const run = readRun(run_id);
  if (!run || run.status !== "open") throw new Error("an open run is required");
  if (!run.roster.includes(persona_id)) throw new Error("persona is not in run roster");
  if (!run.artifact?.url) throw new Error("journey packet requires artifact.url");
  if (!run.study?.objective || !run.study?.target_concepts?.length || !run.study?.tasks?.length || !run.study?.questions?.length) throw new Error("journey packet requires a run created with --study");
  const persona = getPersona(persona_id);
  if (!persona) throw new Error("saved persona not found");
  if (!Array.isArray(viewports) || !viewports.length || viewports.some((x) => !String(x).trim())) throw new Error("viewports must be a nonempty list");
  if (!Array.isArray(tools) || !tools.length || tools.some((x) => !String(x).trim())) throw new Error("tools must be a nonempty list");
  if (!Number.isFinite(budget_minutes) || budget_minutes <= 0 || budget_minutes > 60) throw new Error("budget_minutes must be greater than zero and at most 60");

  const encounter = scaffoldEncounter({ persona_id, run_id, artifact: run.artifact, viewports, driver: tools.join(", "), time_budget: `${budget_minutes} minutes` });
  encounter.conditions.capabilities = {
    navigate: { provider: "computer-use", status: "unverified" },
    interact: { provider: "computer-use", status: "unverified" },
    inspect: { provider: tools.includes("ibr") ? "ibr" : "computer-use", status: "unverified" },
    viewport: { provider: "computer-use", status: "unverified" },
    snapshot: { provider: tools.includes("ibr") ? "ibr" : "screenshot", status: "unverified" },
    ...(tools.includes("spectra") ? { record: { provider: "spectra", status: "unverified" } } : {}),
  };
  encounter.findings = [];
  encounter.decisions = [];
  encounter.journey = { goal: run.study.objective, completed: false, actions: [], snapshots: [] };
  encounter.comprehension = { mode: "procedural-closed-book", answers: run.study.questions.map((q) => ({ question_id: q.id, answer: "", confidence: null })) };
  delete encounter.outcome;
  const validation = validateEncounter(encounter);
  if (!validation.ok) throw new Error(validation.errors.join("; "));

  const publicQuestions = run.study.questions.map(({ id, prompt, type, max_score }) => ({ id, prompt, type, max_score }));
  const packet = {
    schema_version: "1.0.0", run_id, persona_id, artifact: run.artifact,
    profile_sha256: digest(persona), objective: run.study.objective,
    target_concepts: run.study.target_concepts, tasks: run.study.tasks, questions: publicQuestions,
    protocol: {
      context_mode: "fresh", prior_encounters_shown: [], budget_minutes, viewports, allowed_tools: tools,
      prohibited_tools: ["source-code inspection", "network-response inspection", "search engines", "peer findings", "assessor file"],
      required_capabilities: ["navigate", "interact", "inspect", "viewport", "snapshot"],
      observer_tools: { ibr: "Independent accessibility, layout, and screenshot verification; not a substitute for the persona driver.", spectra: "Optional durable journey recording; not a substitute for interaction evidence." },
      capability_preflight: "Exercise every required capability before the journey and record provider, status, and evidence. Do not continue if any required capability is unavailable.",
      snapshot_checkpoints: ["starting state", "each consequential navigation choice", "final learning state", "blocking or confusing state"],
      answer_mode: "Stop browsing before answering. Answer from your understanding of what the interface taught you, without reopening pages.",
    },
    workspace: { user: "USER.md", soul: "SOUL.md", goal: "GOAL.md", capabilities: "CAPABILITIES.md", encounter: "encounter.json" },
    encounter_template: encounter,
    limits: "Synthetic comprehension evidence is a hypothesis, not human validation. Procedural closed-book prevents new browsing but cannot erase model context.",
  };
  const packet_sha256 = digest(packet);
  const result = { ...packet, packet_sha256 };
  const assessment = { schema_version: "1.0.0", assessor_only: true, run_id, persona_id, packet_sha256, questions: run.study.questions,
    rule: "Score only the saved answers. Do not infer understanding from navigation, fluency, or keyword presence alone. Record misconceptions and evidence for every score." };
  const dir = safeStorePath("runs", run_id, "journeys", persona_id, packet_sha256);
  mkdirSync(dir, { recursive: true });
  const writes = {
    "USER.md": `# User\n\nName: ${persona.name}\nRole: ${persona.role || persona.archetype || "New visitor"}\n\n${persona.summary || "A first-time visitor."}\n\n## Primary goal\n\n${persona.primary_goal || run.study.objective}\n\n## Goals\n\n${lines(persona.goals)}\n\n## Frustrations\n\n${lines(persona.frustrations)}\n\n## Behaviors\n\n${lines(persona.behaviors)}\n`,
    "SOUL.md": `# Operating rules\n\n- Stay in character as the user in USER.md.\n- Pursue GOAL.md using only the visible interface and allowed tools.\n- First run the capability preflight in CAPABILITIES.md. Do not claim a journey if the host only describes a tool or interface but does not let you exercise it.\n- Do not inspect source code, network responses, peer findings, or ASSESSOR.json.\n- Capture snapshots at the required checkpoints and describe what is visibly placed there.\n- Record each meaningful action, rationale, result, and URL in encounter.json.\n- If the interface does not support a conclusion, say so. Do not fabricate comprehension or success.\n- Before answering the comprehension questions, stop browsing and do not reopen pages.\n`,
    "GOAL.md": `# Mission\n\n${run.study.objective}\n\nStart at ${run.artifact.url}. Do not use a direct deep link unless the visible interface leads you there.\n\n## Tasks\n\n${run.study.tasks.map((task) => `- [ ] ${task.id}: ${task.instruction}`).join("\n")}\n\n## Concepts to learn\n\n${lines(run.study.target_concepts)}\n\n## Teach-back questions\n\n${publicQuestions.map((q) => `- ${q.id} (${q.type}): ${q.prompt}`).join("\n")}\n`,
    "CAPABILITIES.md": `# Capability preflight\n\nThe host must provide working capabilities, not a description of an interface. Exercise each before starting:\n\n- navigate: open the production URL and confirm the resulting URL.\n- interact: click, type, and scroll a visible control.\n- inspect: read the current accessibility or DOM-backed interface state.\n- viewport: set or verify the assigned viewport.\n- snapshot: capture the rendered state and retain an evidence locator.\n\nIBR may independently verify accessibility, layout, and screenshots. Spectra may record the journey. They are observers, not substitutes for the persona's computer-use driver. For each capability in encounter.conditions.capabilities, record provider, available/unavailable status, attestation \"host-observed\", observed_at, and an evidence locator beginning cua:, ibr:, spectra:, screenshot:, file:, or session:. Stop if any required capability is unavailable.\n`,
    "packet.json": `${JSON.stringify(result, null, 2)}\n`, "ASSESSOR.json": `${JSON.stringify(assessment, null, 2)}\n`, "encounter.json": `${JSON.stringify(encounter, null, 2)}\n`,
  };
  for (const [name, contents] of Object.entries(writes)) writeFileSync(safeStorePath("runs", run_id, "journeys", persona_id, packet_sha256, name), contents, { flag: "wx", mode: 0o600 });
  return { path: dir, packet: result, assessor_path: safeStorePath("runs", run_id, "journeys", persona_id, packet_sha256, "ASSESSOR.json") };
}
