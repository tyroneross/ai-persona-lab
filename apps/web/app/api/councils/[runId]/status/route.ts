import { NextResponse } from "next/server";
import type { ReviewRunStatus } from "@lib/council";
import { fileCouncilRepository } from "@lib/council-repository.server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: status === 404 ? "not_found" : "validation_error",
        message: error instanceof Error ? error.message : "Status request failed.",
      },
    },
    { status },
  );
}

/** PATCH a run's status (must be a valid state-machine transition). */
export async function PATCH(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const body = await request.json();
    const status = body?.status as ReviewRunStatus;
    if (!status) return errorResponse(new Error("status is required."));
    const run = await fileCouncilRepository.updateRunStatus({
      id: runId,
      status,
      message: body?.message,
      expected_updated_at: body?.expected_updated_at,
    });
    return NextResponse.json({ run }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
