"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Persona, Provenance, SourceType } from "@lib/persona";

type Mode = "create" | "edit";

const PROVENANCE_OPTIONS: { value: "" | Provenance; label: string }[] = [
  { value: "", label: "unset" },
  { value: "proto", label: "proto — team assumptions" },
  { value: "qualitative", label: "qualitative — interviews / real research" },
  { value: "synthetic-grounded", label: "synthetic-grounded — AI, grounded in real data" },
  { value: "synthetic-assumed", label: "synthetic-assumed — AI assumption (hypothesis only)" },
];

type FormState = {
  name: string;
  archetype: string;
  role: string;
  summary: string;
  primary_goal: string;
  job_to_be_done: string;
  goals: string;
  frustrations: string;
  motivations: string;
  behaviors: string;
  needs: string;
  anti_goals: string;
  provenance: "" | Provenance;
  scenarios: string;
  evidence_summary: string;
  evidence_source: string;
  confidence: number;
  tags: string;
  status: "draft" | "active" | "archived";
};

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function initialFor(persona: Persona | undefined): FormState {
  return {
    name: persona?.name ?? "",
    archetype: persona?.archetype ?? "",
    role: persona?.role ?? "",
    summary: persona?.summary ?? "",
    primary_goal: persona?.primary_goal ?? "",
    job_to_be_done: persona?.job_to_be_done ?? "",
    goals: (persona?.goals ?? []).join("\n"),
    frustrations: (persona?.frustrations ?? []).join("\n"),
    motivations: (persona?.motivations ?? []).join("\n"),
    behaviors: (persona?.behaviors ?? []).join("\n"),
    needs: (persona?.needs ?? []).join("\n"),
    anti_goals: (persona?.anti_goals ?? []).join("\n"),
    provenance: persona?.provenance ?? "",
    scenarios: (persona?.scenarios ?? [])
      .map((s) => `${s.title} :: ${s.description}`)
      .join("\n"),
    evidence_summary: persona?.evidence?.[0]?.summary ?? "",
    evidence_source: persona?.evidence?.[0]?.source_type ?? "interview",
    confidence: persona?.confidence ?? 0.5,
    tags: (persona?.tags ?? []).join(", "),
    status: persona?.status ?? "draft",
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(state: FormState): Errors {
  const errs: Errors = {};
  const scenarioLines = lines(state.scenarios);
  if (!state.name.trim()) errs.name = "Name is required.";
  if (!state.archetype.trim()) errs.archetype = "Archetype is required.";
  if (!state.role.trim()) errs.role = "Role is required.";
  if (state.summary.trim().length < 40)
    errs.summary = "Summary must be at least 40 characters.";
  if (!state.primary_goal.trim()) errs.primary_goal = "Primary goal is required.";
  if (lines(state.goals).length === 0) errs.goals = "Add at least one goal.";
  if (lines(state.frustrations).length === 0)
    errs.frustrations = "Add at least one frustration.";
  if (lines(state.motivations).length === 0)
    errs.motivations = "Add at least one motivation.";
  if (lines(state.behaviors).length === 0)
    errs.behaviors = "Add at least one behavior.";
  if (lines(state.needs).length === 0) errs.needs = "Add at least one need.";
  if (scenarioLines.length === 0) {
    errs.scenarios = "Add at least one scenario (title :: description).";
  } else if (
    scenarioLines.some((line) => {
      const [title, ...descriptionParts] = line.split("::");
      return !title.trim() || descriptionParts.join("::").trim().length < 20;
    })
  ) {
    errs.scenarios = "Use title :: description with a description of at least 20 characters.";
  }
  if (state.evidence_summary.trim().length < 20)
    errs.evidence_summary = "Evidence summary must be at least 20 characters.";
  if (state.confidence < 0 || state.confidence > 1)
    errs.confidence = "Confidence must be between 0 and 1.";
  return errs;
}

function parseScenarios(value: string) {
  return lines(value).map((line) => {
    const [title, ...descriptionParts] = line.split("::");
    return {
      title: title.trim(),
      description: descriptionParts.join("::").trim(),
    };
  });
}

function buildPersonaPayload(state: FormState, initial?: Persona) {
  return {
    name: state.name.trim(),
    archetype: state.archetype.trim(),
    role: state.role.trim(),
    summary: state.summary.trim(),
    primary_goal: state.primary_goal.trim(),
    job_to_be_done: state.job_to_be_done.trim() || undefined,
    goals: lines(state.goals),
    frustrations: lines(state.frustrations),
    motivations: lines(state.motivations),
    behaviors: lines(state.behaviors),
    needs: lines(state.needs),
    anti_goals: lines(state.anti_goals),
    provenance: state.provenance || undefined,
    scenarios: parseScenarios(state.scenarios),
    evidence: [
      {
        id: initial?.evidence?.[0]?.id,
        source_type: state.evidence_source as SourceType,
        summary: state.evidence_summary.trim(),
        confidence: state.confidence,
      },
    ],
    confidence: state.confidence,
    tags: csv(state.tags),
    status: state.status,
  };
}

export default function PersonaForm({
  mode,
  initial,
}: {
  mode: Mode;
  initial?: Persona;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialFor(initial));
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);

  async function handleGenerate() {
    if (instruction.trim().length < 4 || generating) return;
    setGenerating(true);
    setGenNote(null);
    try {
      const response = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const body = (await response.json()) as {
        persona?: Persona;
        source?: string;
        note?: string;
        error?: { message?: string };
      };
      if (!response.ok || !body.persona) {
        throw new Error(body.error?.message ?? "Generation failed.");
      }
      setState(initialFor(body.persona));
      setGenNote(
        body.source === "scaffold"
          ? (body.note ?? "Prefilled a scaffold — fill in the details.")
          : `Generated with ${body.source}. Review and edit before saving — hypothesis, not validated.`,
      );
    } catch (error) {
      setGenNote(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  const errors = useMemo(() => validate(state), [state]);
  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initialFor(initial)),
    [state, initial]
  );
  const canSubmit = Object.keys(errors).length === 0 && (mode === "create" || dirty);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function showError(key: keyof FormState): string | undefined {
    if (!submitted) return undefined;
    return errors[key];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setSubmitError(null);
    if (Object.keys(errors).length > 0) return;

    try {
      const response = await fetch(
        mode === "create" ? "/api/personas" : `/api/personas/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona: buildPersonaPayload(state, initial) }),
        },
      );
      const body = (await response.json()) as {
        persona?: Persona;
        error?: { message?: string };
      };
      if (!response.ok || !body.persona) {
        throw new Error(body.error?.message ?? "Persona save failed.");
      }
      router.push(`/personas/${body.persona.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Persona save failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl" noValidate>
      <header>
        <h1 className="text-2xl font-semibold text-ink">
          {mode === "create" ? "New persona" : `Edit ${initial?.name ?? "persona"}`}
        </h1>
        <p className="text-sm text-muted mt-1">
          Required fields are validated against{" "}
          <code className="text-xs">schemas/persona.schema.json</code>.
        </p>
      </header>

      {mode === "create" && (
        <section className="rounded-md border border-line bg-surface p-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Generate from an instruction
            </span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              className={inputClass(undefined)}
              placeholder="e.g. a skeptical enterprise security admin reviewing an SSO login flow"
            />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || instruction.trim().length < 4}
              className={
                generating || instruction.trim().length < 4
                  ? "rounded-md bg-line px-4 py-2 text-sm font-medium text-muted cursor-not-allowed"
                  : "rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft transition"
              }
            >
              {generating ? "Generating…" : "Generate & prefill"}
            </button>
            <span className="text-xs text-muted">
              Runs a local model via the agent harness. You edit before saving.
            </span>
          </div>
          {genNote && (
            <p className="mt-2 text-xs text-muted" role="status">
              {genNote}
            </p>
          )}
        </section>
      )}

      <Field label="Name" error={showError("name")}>
        <input
          value={state.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass(showError("name"))}
          placeholder="Morgan Lee"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Archetype" error={showError("archetype")}>
          <input
            value={state.archetype}
            onChange={(e) => update("archetype", e.target.value)}
            className={inputClass(showError("archetype"))}
            placeholder="Operations skeptic"
          />
        </Field>
        <Field label="Role" error={showError("role")}>
          <input
            value={state.role}
            onChange={(e) => update("role", e.target.value)}
            className={inputClass(showError("role"))}
            placeholder="RevOps lead"
          />
        </Field>
      </div>

      <Field label="Summary" error={showError("summary")} hint="At least 40 characters.">
        <textarea
          value={state.summary}
          onChange={(e) => update("summary", e.target.value)}
          rows={3}
          className={inputClass(showError("summary"))}
        />
      </Field>

      <Field label="Primary goal" error={showError("primary_goal")}>
        <input
          value={state.primary_goal}
          onChange={(e) => update("primary_goal", e.target.value)}
          className={inputClass(showError("primary_goal"))}
        />
      </Field>

      <Field
        label="Job to be done"
        hint="When [situation], I want to [motivation], so I can [outcome]."
      >
        <textarea
          value={state.job_to_be_done}
          onChange={(e) => update("job_to_be_done", e.target.value)}
          rows={2}
          className={inputClass(undefined)}
          placeholder="When evaluating a new tool, I want to see its data controls up front, so I can approve without a long back-and-forth."
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListField
          label="Goals"
          value={state.goals}
          onChange={(v) => update("goals", v)}
          error={showError("goals")}
        />
        <ListField
          label="Frustrations"
          value={state.frustrations}
          onChange={(v) => update("frustrations", v)}
          error={showError("frustrations")}
        />
        <ListField
          label="Motivations"
          value={state.motivations}
          onChange={(v) => update("motivations", v)}
          error={showError("motivations")}
        />
        <ListField
          label="Behaviors"
          value={state.behaviors}
          onChange={(v) => update("behaviors", v)}
          error={showError("behaviors")}
        />
        <ListField
          label="Needs"
          value={state.needs}
          onChange={(v) => update("needs", v)}
          error={showError("needs")}
        />
        <ListField
          label="Anti-goals"
          value={state.anti_goals}
          onChange={(v) => update("anti_goals", v)}
        />
      </div>

      <Field
        label="Scenarios"
        error={showError("scenarios")}
        hint="One per line, format: title :: description"
      >
        <textarea
          value={state.scenarios}
          onChange={(e) => update("scenarios", e.target.value)}
          rows={4}
          className={inputClass(showError("scenarios"))}
          placeholder="Weekly forecast review :: Morgan reviews AI-generated risk notes..."
        />
      </Field>

      <fieldset className="rounded-md border border-line p-4 space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted px-1">
          Evidence (at least one required)
        </legend>
        <Field label="Evidence summary" error={showError("evidence_summary")}>
          <textarea
            value={state.evidence_summary}
            onChange={(e) => update("evidence_summary", e.target.value)}
            rows={2}
            className={inputClass(showError("evidence_summary"))}
            placeholder="What this evidence supports..."
          />
        </Field>
        <Field label="Source type">
          <select
            value={state.evidence_source}
            onChange={(e) => update("evidence_source", e.target.value)}
            className={inputClass(undefined)}
          >
            {(
              [
                "interview",
                "survey",
                "analytics",
                "support",
                "sales",
                "desk_research",
                "synthetic",
              ] as const
            ).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {state.evidence_source === "synthetic" && (
            <p className="text-xs text-warn mt-1" role="status">
              Synthetic evidence will be visually flagged in the UI.
            </p>
          )}
        </Field>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Confidence"
          error={showError("confidence")}
          hint="0 = none, 1 = high"
        >
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={state.confidence}
            onChange={(e) => update("confidence", Number(e.target.value))}
            className={inputClass(showError("confidence"))}
          />
        </Field>
        <Field label="Status">
          <select
            value={state.status}
            onChange={(e) => update("status", e.target.value as FormState["status"])}
            className={inputClass(undefined)}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </Field>
      </div>

      <Field
        label="Provenance"
        hint="The basis for this persona. synthetic-* means hypothesis, not validated research."
      >
        <select
          value={state.provenance}
          onChange={(e) => update("provenance", e.target.value as FormState["provenance"])}
          className={inputClass(undefined)}
        >
          {PROVENANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tags" hint="Comma-separated">
        <input
          value={state.tags}
          onChange={(e) => update("tags", e.target.value)}
          className={inputClass(undefined)}
          placeholder="operations, forecasting, auditability"
        />
      </Field>

      {submitError && (
        <div className="rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className={
            canSubmit
              ? "rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft transition"
              : "rounded-md bg-line px-4 py-2 text-sm font-medium text-muted cursor-not-allowed"
          }
        >
          {mode === "create" ? "Create persona" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-muted hover:text-ink hover:border-line-strong transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </label>
  );
}

function ListField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <Field label={label} hint="One per line." error={error}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={inputClass(error)}
      />
    </Field>
  );
}

function inputClass(error: string | undefined): string {
  const base =
    "w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";
  return error ? `${base} border-error` : `${base} border-line`;
}
