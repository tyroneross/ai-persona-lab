import { notFound } from "next/navigation";
import CouncilRunDetail from "@components/CouncilRunDetail";
import { buildCommandPacket } from "@lib/command-packets";
import { fileCouncilRepository } from "@lib/council-repository.server";

export const dynamic = "force-dynamic";

export default async function CouncilRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const bundle = await fileCouncilRepository.getRunBundle(runId);
  if (!bundle) notFound();
  const prompts = await fileCouncilRepository.listPromptVersions(runId);
  return <CouncilRunDetail bundle={bundle} packet={buildCommandPacket(bundle)} prompts={prompts} />;
}
