import { NextResponse } from "next/server";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { buildSynthesis } from "@lib/council-writeback";
import { canTransitionStatus } from "@lib/council-validation";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: status === 404 ? "not_found" : "validation_error",
        message: error instanceof Error ? error.message : "Synthesis request failed.",
      },
    },
    { status },
  );
}

/** PUT the synthesis for a run and advance it to complete when possible. */
export async function PUT(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const bundle = await fileCouncilRepository.getRunBundle(runId);
    if (!bundle) return errorResponse(new Error(`Run ${runId} not found.`), 404);

    const body = await request.json();
    const now = new Date().toISOString();
    const synthesis = buildSynthesis(bundle, body?.synthesis ?? body, now);
    await fileCouncilRepository.setSynthesis(synthesis);

    // Advance running -> synthesizing -> complete where the state machine allows.
    let status = bundle.run.status;
    for (const next of ["synthesizing", "complete"] as const) {
      if (canTransitionStatus(status, next)) {
        const updated = await fileCouncilRepository.updateRunStatus({ id: runId, status: next });
        status = updated.status;
      }
    }

    return NextResponse.json({ synthesis, status }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
