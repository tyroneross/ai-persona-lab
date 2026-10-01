#!/usr/bin/env node

import fs from "node:fs";
import { selectLennyPersonas } from "../lib/lenny-catalog.mjs";

const ROLE_LIBRARY = [
  {
    name: "Product manager",
    perspective: "product",
    keywords: ["feature", "roadmap", "prioritize", "adoption", "activation", "retention", "product"],
    primaryQuestion: "Does this support the intended product outcome?",
    successSignal: "The path to value is obvious and measurable.",
    failureSignal: "The experience creates unclear priority, weak activation, or missing feedback loops."
  },
  {
    name: "UX designer",
    perspective: "design",
    keywords: ["ui", "ux", "design", "screen", "flow", "layout", "prototype", "interaction", "form"],
    primaryQuestion: "Can the user understand the interface and complete the task with low friction?",
    successSignal: "Hierarchy, controls, states, and recovery paths are clear.",
    failureSignal: "The user hesitates, misses the next action, or cannot recover from errors."
  },
  {
    name: "UX researcher",
    perspective: "research",
    keywords: ["research", "persona", "interview", "survey", "evidence", "assumption", "test"],
    primaryQuestion: "What assumptions need evidence before this decision is trusted?",
    successSignal: "The plan separates observed behavior from inference.",
    failureSignal: "Synthetic assumptions are treated as validated user research."
  },
  {
    name: "Skeptical target user",
    perspective: "user",
    keywords: ["user", "customer", "onboarding", "trial", "signup", "workflow", "task"],
    primaryQuestion: "Would this user trust the product enough to continue?",
    successSignal: "Value, next step, and risk are clear quickly.",
    failureSignal: "The user does not see enough value or confidence to proceed."
  },
  {
    name: "Accessibility reviewer",
    perspective: "accessibility",
    keywords: ["ui", "form", "content", "screen", "mobile", "accessibility", "keyboard", "contrast"],
    primaryQuestion: "Can people with different abilities and contexts use this without avoidable barriers?",
    successSignal: "The flow supports keyboard, screen reader, visual clarity, and cognitive predictability.",
    failureSignal: "Controls, contrast, text, focus, or error states exclude users."
  },
  {
    name: "Frontend engineer",
    perspective: "engineering",
    keywords: ["frontend", "component", "react", "next", "state", "performance", "responsive", "error"],
    primaryQuestion: "Can this be implemented reliably across states, devices, and edge cases?",
    successSignal: "The implementation has stable states, responsive behavior, and clear data boundaries.",
    failureSignal: "The UI depends on brittle state, missing empty/error cases, or layout assumptions."
  },
  {
    name: "Data analyst",
    perspective: "measurement",
    keywords: ["metric", "analytics", "dashboard", "data", "measure", "kpi", "conversion", "experiment"],
    primaryQuestion: "Can success and failure be measured from the available data?",
    successSignal: "Instrumentation and decision metrics are explicit.",
    failureSignal: "The team cannot tell whether the change helped or hurt."
  },
  {
    name: "Security and privacy reviewer",
    perspective: "risk",
    keywords: ["security", "privacy", "auth", "permission", "pii", "compliance", "admin", "enterprise"],
    primaryQuestion: "Could this expose data, create trust risk, or fail expected controls?",
    successSignal: "Permissions, data handling, and sensitive states are explicit.",
    failureSignal: "The flow leaks data, hides risk, or lacks review/audit controls."
  },
  {
    name: "Customer success manager",
    perspective: "support",
    keywords: ["support", "rollout", "onboarding", "training", "help", "docs", "customer success"],
    primaryQuestion: "Will customers adopt this without creating avoidable support load?",
    successSignal: "The product explains itself and failure paths are supportable.",
    failureSignal: "The flow creates repeated questions, unclear ownership, or difficult handoffs."
  },
  {
    name: "Sales or revenue leader",
    perspective: "revenue",
    keywords: ["sales", "pricing", "buyer", "enterprise", "conversion", "demo", "pipeline", "revenue"],
    primaryQuestion: "Does this answer buyer objections and support conversion?",
    successSignal: "The value proposition, proof, and commercial path are clear.",
    failureSignal: "The experience leaves key objections unanswered."
  },
  {
    name: "General manager",
    perspective: "strategy",
    keywords: ["gm", "google", "strategy", "market", "scale", "business", "platform", "portfolio"],
    primaryQuestion: "Does this fit the strategic context and scale without hidden operational drag?",
    successSignal: "The plan aligns user value, business model, and execution leverage.",
    failureSignal: "The plan optimizes a local feature while missing strategic risk."
  },
  {
    name: "Domain expert",
    perspective: "domain",
    keywords: ["healthcare", "finance", "education", "legal", "developer", "devtool", "regulated", "workflow"],
    primaryQuestion: "Does this respect the domain's real constraints and language?",
    successSignal: "The experience matches domain workflows, terms, risks, and trust expectations.",
    failureSignal: "Generic product assumptions conflict with domain reality."
  }
];

function parseArgs(argv) {
  const options = { json: false, count: 5, file: null, prompt: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--count") {
      options.count = Number.parseInt(argv[++i] || "5", 10);
    } else if (arg === "--file") {
      options.file = argv[++i] || null;
    } else {
      options.prompt.push(arg);
    }
  }
  options.count = Number.isFinite(options.count) ? Math.min(Math.max(options.count, 3), 8) : 5;
  return options;
}

function readInput(options) {
  const chunks = [];
  if (options.file) {
    chunks.push(fs.readFileSync(options.file, "utf8"));
  }
  if (options.prompt.length > 0) {
    chunks.push(options.prompt.join(" "));
  }
  if (!process.stdin.isTTY) {
    const stdin = fs.readFileSync(0, "utf8").trim();
    if (stdin) chunks.push(stdin);
  }
  return chunks.join("\n\n").trim();
}

function countMatches(text, words) {
  return words.reduce((score, word) => (text.includes(word) ? score + 1 : score), 0);
}

function inferIntent(text) {
  if (/(ui|ux|screen|layout|onboarding|form|dashboard|prototype|flow)/.test(text)) return "UI or workflow review";
  if (/(api|schema|contract|integration|endpoint|sdk)/.test(text)) return "API or integration review";
  if (/(pricing|conversion|landing|growth|sales|revenue)/.test(text)) return "Growth or revenue review";
  if (/(strategy|market|competitor|gm|portfolio|positioning)/.test(text)) return "Strategy review";
  if (/(security|privacy|auth|permission|compliance|risk)/.test(text)) return "Risk review";
  return "Product request review";
}

function needsResearch(text) {
  return /(latest|current|today|market|competitor|pricing|regulation|law|standard|google|apple|microsoft|openai|industry|benchmark|public reviews?)/.test(text);
}

function accessNeeds(text) {
  const needs = [];
  if (/(ui|screen|layout|flow|prototype|form|dashboard|onboarding)/.test(text)) {
    needs.push("running app URL, screenshots, or UI source files");
  }
  if (/(metric|analytics|conversion|experiment|kpi|retention)/.test(text)) {
    needs.push("analytics, event definitions, or target metrics");
  }
  if (/(customer|user|persona|research|interview|survey)/.test(text)) {
    needs.push("target audience notes, research evidence, or explicit assumptions");
  }
  if (needsResearch(text)) {
    needs.push("current web research access for market or role context");
  }
  if (needs.length === 0) {
    needs.push("task brief, target artifact, success criteria, and any constraints");
  }
  return needs;
}

function selectRoles(rawPrompt, count) {
  const text = rawPrompt.toLowerCase();
  const scored = ROLE_LIBRARY.map((role, index) => {
    let score = countMatches(text, role.keywords) * 10;
    if (/(ui|ux|screen|layout|flow|form|dashboard|onboarding)/.test(text)) {
      if (["design", "user", "accessibility", "engineering", "product"].includes(role.perspective)) score += 8;
    }
    if (/(enterprise|admin|security|privacy|permission)/.test(text) && ["risk", "support", "product"].includes(role.perspective)) score += 7;
    if (/(google|gm|strategy|market|scale)/.test(text) && role.perspective === "strategy") score += 12;
    if (score === 0 && ["product", "design", "user", "accessibility", "engineering"].includes(role.perspective)) score = 3;
    return { ...role, score, index };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map(({ score, index, ...role }) => role);
}

function buildPlan(prompt, count) {
  const normalized = prompt || "No request provided.";
  const text = normalized.toLowerCase();
  const personas = selectRoles(normalized, count);
  return {
    request: normalized,
    inferredIntent: inferIntent(text),
    researchRecommended: needsResearch(text),
    accessNeeds: accessNeeds(text),
    personas,
    lennySelection: selectLennyPersonas(normalized, { limit: count }),
    measurement: [
      "Task completion",
      "Comprehension",
      "Friction",
      "Trust",
      "Risk",
      "Business fit"
    ],
    launchSteps: [
      "Confirm target artifact and access.",
      "Inspect available evidence before judging.",
      "Run one independent pass per selected persona.",
      "Score findings by severity and confidence.",
      "Synthesize priority fixes without hiding dissenting critical concerns."
    ]
  };
}

function renderMarkdown(plan) {
  const rows = plan.personas
    .map((persona) => `| ${persona.name} | ${persona.perspective} | ${persona.primaryQuestion} | ${persona.successSignal} | ${persona.failureSignal} |`)
    .join("\n");

  return `# Persona Panel Plan

## Bottom Line

Launch ${plan.personas.length} persona perspectives for a ${plan.inferredIntent.toLowerCase()}.

## Request

${plan.request}

## Access Needs

${plan.accessNeeds.map((need) => `- ${need}`).join("\n")}

## Research

${plan.researchRecommended ? "Current web research is recommended before making current-state claims." : "Current web research is not required by the detected request, unless new context appears."}

## Persona Roster

| Persona | Perspective | Primary question | Success signal | Failure signal |
| --- | --- | --- | --- | --- |
${rows}

## Lenny role suggestions

${plan.lennySelection.results.map(role => `- ${role.name}: ${role.reason}. Question: ${role.primary_question}`).join("\n") || plan.lennySelection.next_step}

${plan.lennySelection.policy}

## Measurement

${plan.measurement.map((item) => `- ${item}`).join("\n")}

## Launch Steps

${plan.launchSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}
`;
}

const options = parseArgs(process.argv.slice(2));
const input = readInput(options);
const plan = buildPlan(input, options.count);

if (options.json) {
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
} else {
  process.stdout.write(renderMarkdown(plan));
}
