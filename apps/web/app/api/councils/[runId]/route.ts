import { NextResponse } from "next/server";
import { fileCouncilRepository } from "@lib/council-repository.server";
import { buildCommandPacket } from "@lib/command-packets";

export const dynamic = "force-dynamic";

/** GET the full run bundle plus its command packet (for autonomous drivers). */
export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const bundle = await fileCouncilRepository.getRunBundle(runId);
  if (!bundle) {
    return NextResponse.json(
      { error: { code: "not_found", message: `Run ${runId} not found.` } },
      { status: 404 },
    );
  }
  return NextResponse.json({ bundle, command_packet: buildCommandPacket(bundle) });
}
