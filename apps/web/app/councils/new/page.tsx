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
      <section className="glass p-6">
        <h2 className="text-section text-ink">Build a roster from your saved personas</h2>
        <p className="mt-3 text-body text-muted">
          Turn personas from your shared library (<code className="font-mono text-meta">~/.persona-lab</code>)
          into a council roster. Councils are the large-panel review; you have{" "}
          <span className="font-medium text-ink">{count}</span>{" "}
          {count === 1 ? "persona" : "personas"} saved.
        </p>
        {canBuild ? (
          <form action={createRosterFromLibraryAction} className="mt-5 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="field-label">
                Roster name (optional)
              </span>
              <input
                name="roster_name"
                placeholder="Enterprise rollout review"
                className="review-field mt-2 w-64"
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Build roster from {count} personas
            </button>
          </form>
        ) : (
          <p className="mt-4 text-meta font-medium text-warn" role="status">
            Councils need at least {MIN_LIBRARY_PERSONAS_FOR_ROSTER} saved personas for the high
            level. Generate more with the persona CLI (<code className="font-mono text-meta">persona new</code>),
            or use <code className="font-mono text-meta">persona panel</code> for a lighter 3-6 lens critique.
          </p>
        )}
      </section>

      <CouncilRunForm rosters={rosters} />
    </div>
  );
}
