import type { RepoPersonaRoster } from "@lib/council";
import { councilTypeLabels, reviewLevelLabels } from "@lib/council";
import { createCouncilRunAction } from "@/app/councils/actions";
import RosterPassSelector from "./RosterPassSelector";

const councilTypes = Object.entries(councilTypeLabels);
const reviewLevels = Object.entries(reviewLevelLabels);

export default function CouncilRunForm({ rosters }: { rosters: RepoPersonaRoster[] }) {
  const roster = rosters[0];

  if (!roster) {
    return (
      <section className="rounded-md border border-dashed border-line-strong bg-surface p-6">
        <p className="text-xs font-semibold uppercase text-muted">Persona councils</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">No roster configured</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Add or generate a repository persona roster before planning a council
          run. This app does not create reviews from hidden sample data.
        </p>
      </section>
    );
  }

  return (
    <form action={createCouncilRunAction} className="space-y-8">
      <input type="hidden" name="roster_id" value={roster.id} />

      <section className="rounded-md border border-line bg-surface p-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase text-muted">First-run setup</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Plan a persona review</h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Medium and high runs need a complete measurement plan before launch.
            Synthetic and mixed evidence remains disclosed in the output.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">Review request</span>
            <textarea
              name="request"
              required
              minLength={10}
              rows={5}
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-offset-2 focus:outline-current"
              placeholder="Describe what the council should review and what decision it should support."
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-ink">Council type</span>
              <select
                name="council_type"
                className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                defaultValue="ui_test"
              >
                {councilTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Level</span>
              <select
                name="level"
                className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                defaultValue="medium"
              >
                {reviewLevels.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Coordination</span>
              <select
                name="coordination_mode"
                className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
                defaultValue="rally"
              >
                <option value="local">Local</option>
                <option value="host_subagents">Host subagents</option>
                <option value="rally">Rally</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-ink">Target artifacts</span>
            <textarea
              name="target_artifacts"
              rows={4}
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-offset-2 focus:outline-current"
              placeholder={"app/path-or-doc.md\nsrc/module-or-flow.ts"}
            />
          </label>
        </div>

        <RosterPassSelector
          personas={roster.personas}
          defaultSelected={roster.default_levels.medium ?? []}
        />
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Measurement plan</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-ink">Decision supported</span>
            <input
              name="decision_supported"
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder="Decision the run should support"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink">Reviewer quality gate</span>
            <input
              name="reviewer_quality_gate"
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder="Quality bar before this run can be treated as complete"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-ink">Success signals</span>
            <textarea
              name="success_signals"
              rows={3}
              required
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder={"Findings cite evidence or assumptions\nRecommended actions are specific"}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-ink">Failure signals</span>
            <textarea
              name="failure_signals"
              rows={3}
              required
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder={"Findings cannot be traced to evidence\nNo clear next action"}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-ink">Evidence required</span>
            <textarea
              name="evidence_required"
              rows={3}
              required
              className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
              placeholder={"Target files\nPersona roster\nRelevant prior research"}
            />
          </label>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm text-ink-soft">
          <input name="use_planner" type="checkbox" defaultChecked />
          Use the deterministic persona-plan adapter to prefill review discipline.
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink-soft"
        >
          Create draft run
        </button>
      </div>
    </form>
  );
}
