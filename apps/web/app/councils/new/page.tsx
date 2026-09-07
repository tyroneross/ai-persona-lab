import CouncilRunForm from "@components/CouncilRunForm";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { filePersonaRepository } from "@lib/persona-repository.server";
import { MIN_LIBRARY_PERSONAS_FOR_ROSTER } from "@lib/council-library-adapter";
import { createRosterFromLibraryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCouncilRunPage() {
  const [rosters, libraryPersonas] = await Promise.all([
    fileCouncilRepository.listRosters(),
    filePersonaRepository.listPersonas({ status: ["draft", "active"] }),
  ]);

  const count = libraryPersonas.length;
  const canBuild = count >= MIN_LIBRARY_PERSONAS_FOR_ROSTER;

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Build a roster from your saved personas</h2>
        <p className="mt-1 text-sm text-muted">
          Turn personas from your shared library (<code className="text-xs">~/.persona-lab</code>)
          into a council roster. Councils are the large-panel review; you have{" "}
          <span className="font-medium text-ink">{count}</span>{" "}
          {count === 1 ? "persona" : "personas"} saved.
        </p>
        {canBuild ? (
          <form action={createRosterFromLibraryAction} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Roster name (optional)
              </span>
              <input
                name="roster_name"
                placeholder="Enterprise rollout review"
                className="mt-1 w-64 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink-soft transition"
            >
              Build roster from {count} personas
            </button>
          </form>
        ) : (
          <p className="mt-3 text-xs text-warn" role="status">
            Councils need at least {MIN_LIBRARY_PERSONAS_FOR_ROSTER} saved personas for the high
            level. Generate more with the persona CLI (<code className="text-xs">persona new</code>),
            or use <code className="text-xs">persona panel</code> for a lighter 3-6 lens critique.
          </p>
        )}
      </section>

      <CouncilRunForm rosters={rosters} />
    </div>
  );
}
