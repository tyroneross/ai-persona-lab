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
    <aside className="rounded-md border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">Roster</h2>
      <div className="mt-4 space-y-3">
        {personas.map((persona) => (
          <label key={persona.id} className="flex gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="persona_ids"
              value={persona.id}
              checked={selected.has(persona.id)}
              onChange={(e) => toggle(persona.id, e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-ink">{persona.name}</span>
              <span className="block text-xs text-muted">
                {persona.lens} / {persona.role}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <label className="block">
          <span className="text-sm font-medium text-ink">Runs per persona</span>
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
            className="mt-2 w-24 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          {selected.size} {selected.size === 1 ? "persona" : "personas"} x {runs}{" "}
          {runs === 1 ? "pass" : "passes"} = <span className="font-medium text-ink">{totalPasses}</span>{" "}
          total reviews. Up to {runsPerPersonaBounds.max} per persona.
        </p>
        {overBudget && (
          <p className="mt-2 text-xs text-warn" role="status">
            {totalPasses} passes exceeds {runsPerPersonaBounds.warnAbove}. Expect significant token
            usage; reduce personas or runs per persona to lower cost.
          </p>
        )}
      </div>
    </aside>
  );
}
