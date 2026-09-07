import { notFound } from "next/navigation";
import { filePersonaRepository } from "@lib/persona-repository.server";
import PersonaDetail from "@components/PersonaDetail";

export const dynamic = "force-dynamic";

export default async function PersonaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const persona = await filePersonaRepository.getPersona(id);
  if (!persona) notFound();
  return <PersonaDetail persona={persona} />;
}
