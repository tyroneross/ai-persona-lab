import { filePersonaRepository } from "@lib/persona-repository.server";
import ReviewWorkspace from "@components/ReviewWorkspace";
export const dynamic = "force-dynamic";
export default async function PersonasIndexPage() {
  return <ReviewWorkspace personas={await filePersonaRepository.listPersonas()} />;
}
