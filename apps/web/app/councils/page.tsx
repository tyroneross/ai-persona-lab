import CouncilRunList from "@components/CouncilRunList";
import { fileCouncilRepository } from "@lib/council-repository.server";

export const dynamic = "force-dynamic";

export default async function CouncilsPage() {
  const runs = await fileCouncilRepository.listRuns();
  return <CouncilRunList runs={runs} />;
}
