import { NextResponse } from "next/server";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { buildFinding } from "@lib/council-writeback";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: status === 404 ? "not_found" : "validation_error",
        message: error instanceof Error ? error.message : "Finding request failed.",
      },
    },
    { status },
  );
}

/** POST a finding (draft) produced by a persona review pass. */
export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const bundle = await fileCouncilRepository.getRunBundle(runId);
    if (!bundle) return errorResponse(new Error(`Run ${runId} not found.`), 404);

    const body = await request.json();
    const drafts = Array.isArray(body?.findings)
      ? body.findings
      : [body?.finding ?? body];

    const now = new Date().toISOString();
    const saved = [];
    for (const draft of drafts) {
      const finding = buildFinding(bundle, draft, now);
      saved.push(await fileCouncilRepository.addFinding(finding));
    }

    await fileCouncilRepository.appendRunEvent({
      run_id: runId,
      operation: "record_findings",
      actor: "claude_code",
      outcome: "success",
      message: `${saved.length} finding(s) recorded.`,
    });

    return NextResponse.json({ findings: saved }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
