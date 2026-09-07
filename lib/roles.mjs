/**
 * Shared lens/role library for persona-lab.
 *
 * A "lens" is a review perspective. Select useful coverage of goals,
 * jobs-to-be-done and risk; professional expertise may overlap. At least one adversarial
 * (red-team) lens is required in every panel to counter LLM positivity bias.
 *
 * The six lenses flagged `default_critique: true` are the research-backed
 * starter set for critiquing an artifact (novice, power user, red-team,
 * accessibility, buyer, domain specialist).
 *
 * Each lens carries a default `recall` scope, because whether a persona should
 * bring its own history is a property of the ROLE, not a dispatcher's mood.
 * Expertise-bearing lenses (architect, security, domain, red-team) accumulate —
 * one that forgets prior assessments is worse at its job. Naivety-bearing
 * lenses (novice) must stay at "none" — a first-run user who remembers is no
 * longer a first-run user, and that loss cannot be undone. The UX researcher
 * sits at "artifact": fresh on a new problem, continuous on an ongoing one.
 */

export const ROLE_LIBRARY = [
  // --- Default critique lenses (research-backed starter set) ---
  {
    name: "Novice / first-run user",
    perspective: "novice",
    recall: "none",
    default_critique: true,
    keywords: ["onboarding", "signup", "trial", "first", "new user", "getting started", "learn", "setup"],
    primaryQuestion: "Can a first-time user understand what this is and reach first value without help?",
    successSignal: "The purpose, next step, and payoff are obvious within the first screen or two.",
    failureSignal: "Jargon, hidden next steps, or unexplained concepts stall the first run.",
  },
  {
    name: "Power user / expert",
    perspective: "power-user",
    recall: "all",
    default_critique: true,
    keywords: ["power", "expert", "shortcut", "keyboard", "bulk", "density", "advanced", "repeat", "efficiency"],
    primaryQuestion: "Can a frequent expert user move fast without friction, ceilings, or hand-holding?",
    successSignal: "Shortcuts, density, bulk actions, and escape hatches support repeat workflows.",
    failureSignal: "The flow is padded for novices and slows an expert with no way to skip ahead.",
  },
  {
    name: "Skeptic / red-team",
    perspective: "red-team",
    recall: "all",
    default_critique: true,
    adversarial: true,
    keywords: ["trust", "risk", "fail", "edge case", "abandon", "scam", "overclaim", "doubt", "broken"],
    primaryQuestion: "What would make this user distrust, abandon, or break this — and where does it overclaim?",
    successSignal: "Failure paths, edge cases, and honest limits are handled; claims are backed.",
    failureSignal: "Happy-path only; unhandled errors, over-claims, or trust gaps drive abandonment.",
  },
  {
    name: "Accessibility / constraint-bound user",
    perspective: "accessibility",
    recall: "project",
    default_critique: true,
    keywords: ["accessibility", "a11y", "keyboard", "screen reader", "contrast", "cognitive", "mobile", "low bandwidth", "disability"],
    primaryQuestion: "Can people with different abilities, devices, and contexts use this without avoidable barriers?",
    successSignal: "Keyboard flow, semantics, contrast, cognitive load, and constrained contexts are handled.",
    failureSignal: "Controls, contrast, focus, text, or error states exclude users or assume ideal conditions.",
  },
  {
    name: "Decision-maker / buyer",
    perspective: "buyer",
    recall: "project",
    default_critique: true,
    keywords: ["buyer", "pricing", "roi", "budget", "procure", "enterprise", "value", "cost", "approve", "purchase"],
    primaryQuestion: "Does this justify the cost and risk to the person who approves or pays for it?",
    successSignal: "Value, proof, cost, and risk are clear enough to approve or advance.",
    failureSignal: "Key objections, ROI, or risk controls are unanswered for the person holding the budget.",
  },
  {
    name: "Domain specialist",
    perspective: "domain",
    recall: "all",
    default_critique: true,
    keywords: ["healthcare", "finance", "legal", "education", "developer", "devtool", "regulated", "clinical", "compliance", "workflow"],
    primaryQuestion: "Does this respect the domain's real constraints, language, and trust expectations?",
    successSignal: "Terms, workflows, risks, and correctness match how the domain actually operates.",
    failureSignal: "Generic product assumptions conflict with domain reality, rules, or vocabulary.",
  },

  // --- Extended role catalog ---
  {
    name: "Product manager",
    perspective: "product",
    recall: "project",
    keywords: ["feature", "roadmap", "prioritize", "adoption", "activation", "retention", "product", "outcome"],
    primaryQuestion: "Does this support the intended product outcome?",
    successSignal: "The path to value is obvious and measurable.",
    failureSignal: "The experience creates unclear priority, weak activation, or missing feedback loops.",
  },
  {
    name: "UX designer",
    perspective: "design",
    recall: "project",
    keywords: ["ui", "ux", "design", "screen", "flow", "layout", "prototype", "interaction", "form"],
    primaryQuestion: "Can the user understand the interface and complete the task with low friction?",
    successSignal: "Hierarchy, controls, states, and recovery paths are clear.",
    failureSignal: "The user hesitates, misses the next action, or cannot recover from errors.",
  },
  {
    name: "UX researcher",
    perspective: "research",
    recall: "artifact",
    keywords: ["research", "persona", "interview", "survey", "evidence", "assumption", "test"],
    primaryQuestion: "What assumptions need evidence before this decision is trusted?",
    successSignal: "The plan separates observed behavior from inference.",
    failureSignal: "Synthetic assumptions are treated as validated user research.",
  },
  {
    name: "Frontend engineer",
    perspective: "engineering",
    recall: "all",
    keywords: ["frontend", "component", "react", "next", "state", "performance", "responsive", "error"],
    primaryQuestion: "Can this be implemented reliably across states, devices, and edge cases?",
    successSignal: "The implementation has stable states, responsive behavior, and clear data boundaries.",
    failureSignal: "The UI depends on brittle state, missing empty/error cases, or layout assumptions.",
  },
  {
    name: "Data analyst",
    perspective: "measurement",
    recall: "all",
    keywords: ["metric", "analytics", "dashboard", "data", "measure", "kpi", "conversion", "experiment"],
    primaryQuestion: "Can success and failure be measured from the available data?",
    successSignal: "Instrumentation and decision metrics are explicit.",
    failureSignal: "The team cannot tell whether the change helped or hurt.",
  },
  {
    name: "Security and privacy reviewer",
    perspective: "risk",
    recall: "all",
    adversarial: true,
    keywords: ["security", "privacy", "auth", "permission", "pii", "compliance", "admin", "enterprise"],
    primaryQuestion: "Could this expose data, create trust risk, or fail expected controls?",
    successSignal: "Permissions, data handling, and sensitive states are explicit.",
    failureSignal: "The flow leaks data, hides risk, or lacks review/audit controls.",
  },
  {
    name: "Customer success manager",
    perspective: "support",
    recall: "all",
    keywords: ["support", "rollout", "onboarding", "training", "help", "docs", "customer success"],
    primaryQuestion: "Will customers adopt this without creating avoidable support load?",
    successSignal: "The product explains itself and failure paths are supportable.",
    failureSignal: "The flow creates repeated questions, unclear ownership, or difficult handoffs.",
  },
  {
    name: "Sales or revenue leader",
    perspective: "revenue",
    recall: "project",
    keywords: ["sales", "pricing", "buyer", "enterprise", "conversion", "demo", "pipeline", "revenue"],
    primaryQuestion: "Does this answer buyer objections and support conversion?",
    successSignal: "The value proposition, proof, and commercial path are clear.",
    failureSignal: "The experience leaves key objections unanswered.",
  },
  {
    name: "General manager",
    perspective: "strategy",
    recall: "all",
    keywords: ["gm", "strategy", "market", "scale", "business", "platform", "portfolio", "positioning"],
    primaryQuestion: "Does this fit the strategic context and scale without hidden operational drag?",
    successSignal: "The plan aligns user value, business model, and execution leverage.",
    failureSignal: "The plan optimizes a local feature while missing strategic risk.",
  },
  {
    name: "Content designer",
    perspective: "content",
    recall: "project",
    keywords: ["copy", "content", "label", "microcopy", "error text", "wording", "voice", "tone"],
    primaryQuestion: "Is the language clear, honest, and free of jargon at every step?",
    successSignal: "Labels, errors, and guidance read plainly and set correct expectations.",
    failureSignal: "Copy is vague, jargon-heavy, over-promising, or unclear at failure points.",
  },
];

/** Lenses flagged as the research-backed default critique set. */
export const DEFAULT_CRITIQUE_LENSES = ROLE_LIBRARY.filter((r) => r.default_critique);

/** True if a lens is an adversarial / red-team perspective. */
export function isAdversarial(role) {
  return Boolean(role.adversarial);
}

/** Find a lens by name or perspective slug (case-insensitive). */
export function findRole(nameOrSlug) {
  const q = String(nameOrSlug).toLowerCase().trim();
  return (
    ROLE_LIBRARY.find((r) => r.name.toLowerCase() === q) ||
    ROLE_LIBRARY.find((r) => r.perspective.toLowerCase() === q) ||
    ROLE_LIBRARY.find((r) => r.name.toLowerCase().includes(q)) ||
    null
  );
}

function countMatches(text, words) {
  return words.reduce((score, word) => (text.includes(word) ? score + 1 : score), 0);
}

/**
 * Select `count` distinct lenses for a brief, guaranteeing at least one
 * adversarial lens (research: counter LLM positivity bias structurally).
 */
export function selectRoles(rawPrompt, count = 5) {
  const text = String(rawPrompt || "").toLowerCase();
  const n = Math.min(Math.max(count, 3), 8);

  const scored = ROLE_LIBRARY.map((role, index) => {
    let score = countMatches(text, role.keywords) * 10;
    if (/(ui|ux|screen|layout|flow|form|dashboard|onboarding)/.test(text)) {
      if (["novice", "design", "accessibility", "engineering", "power-user"].includes(role.perspective)) score += 6;
    }
    if (/(enterprise|admin|security|privacy|permission|buyer)/.test(text) && ["risk", "buyer", "support"].includes(role.perspective)) score += 7;
    if (/(strategy|market|scale|portfolio)/.test(text) && role.perspective === "strategy") score += 10;
    // Baseline floor so the default critique lenses are always in contention.
    if (score === 0 && role.default_critique) score = 3;
    return { role, score, index };
  });

  const ranked = scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.role);

  const selected = ranked.slice(0, n);

  // Guarantee at least one adversarial lens.
  if (!selected.some(isAdversarial)) {
    const adversary = ranked.find((r) => isAdversarial(r)) || findRole("red-team");
    if (adversary) selected[selected.length - 1] = adversary;
  }
  // UI reviews must retain accessibility alongside the adversary within budget.
  if (/\b(ui|ux|screen|layout|flow|form|dashboard|onboarding|interface)\b/.test(text) && !selected.some((role) => role.perspective === 'accessibility')) {
    const accessibility = findRole('accessibility');
    const replaceIndex = selected.findLastIndex((role) => !isAdversarial(role));
    if (accessibility && replaceIndex >= 0) selected[replaceIndex] = accessibility;
  }
  return selected;
}
