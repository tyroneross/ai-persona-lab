import { NextResponse } from "next/server";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { filePersonaRepository } from "@lib/persona-repository.server";
import { buildRosterInputFromPersonas } from "@lib/council-library-adapter";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: "validation_error",
        message: error instanceof Error ? error.message : "Roster request failed.",
      },
    },
    { status },
  );
}

/** GET all council rosters. */
export async function GET() {
  const rosters = await fileCouncilRepository.listRosters();
  return NextResponse.json({ rosters });
}

/** POST a council roster built from saved library personas. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const selectedIds: string[] = Array.isArray(body?.persona_ids) ? body.persona_ids : [];
    const { personas } = await filePersonaRepository.exportPersonas(
      selectedIds.length > 0 ? selectedIds : undefined,
    );
    const usable = personas.filter((p) => p.status !== "archived");
    const roster = await fileCouncilRepository.createRoster(
      buildRosterInputFromPersonas(usable, {
        repoPath: body?.repo_path || process.cwd(),
        name: body?.name,
      }),
    );
    return NextResponse.json({ roster }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
