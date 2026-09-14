"use client";

import { useMemo, useState } from "react";
import type { RosterPersona } from "@lib/council";
import { runsPerPersonaBounds } from "@lib/council";

/**
 * Persona selection + runs-per-persona, with a live token-cost warning.
 * A persona can be reviewed up to `max` times; total passes above `warnAbove`
 * surface a warning before the run is created.
 */
export default function RosterPassSelector({
  personas,
  defaultSelected,
}: {
  personas: RosterPersona[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  const [runs, setRuns] = useState(1);

  const totalPasses = useMemo(() => selected.size * runs, [selected, runs]);
  const overBudget = totalPasses > runsPerPersonaBounds.warnAbove;

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <aside className="glass p-5">
      <h2 className="text-section text-ink">Roster</h2>
      <div className="mt-5 space-y-4">
        {personas.map((persona) => (
          <label
            key={persona.id}
            className="choice-target flex gap-3 text-body text-ink-soft"
          >
            <input
              type="checkbox"
              name="persona_ids"
              value={persona.id}
              checked={selected.has(persona.id)}
              onChange={(e) => toggle(persona.id, e.target.checked)}
              className="mt-1.5"
            />
            <span>
              <span className="block font-medium text-ink">{persona.name}</span>
              <span className="block text-meta text-muted">
                {persona.lens} / {persona.role}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-8">
        <label className="block">
          <span className="text-body font-medium text-ink">Runs per persona</span>
          <input
            type="number"
            name="runs_per_persona"
            min={runsPerPersonaBounds.min}
            max={runsPerPersonaBounds.max}
            value={runs}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value) || 1);
              setRuns(Math.min(Math.max(n, runsPerPersonaBounds.min), runsPerPersonaBounds.max));
            }}
            className="review-field mt-2 w-24"
          />
        </label>
        <p className="mt-3 text-meta text-muted">
          {selected.size} {selected.size === 1 ? "persona" : "personas"} x {runs}{" "}
          {runs === 1 ? "pass" : "passes"} = <span className="font-medium text-ink">{totalPasses}</span>{" "}
          total reviews. Up to {runsPerPersonaBounds.max} per persona.
        </p>
        {overBudget && (
          <p className="mt-3 text-meta font-medium text-warn" role="status">
            {totalPasses} passes exceeds {runsPerPersonaBounds.warnAbove}. Expect significant token
            usage; reduce personas or runs per persona to lower cost.
          </p>
        )}
      </div>
    </aside>
  );
}
