import { notFound } from "next/navigation";
import { filePersonaRepository } from "@lib/persona-repository.server";
import PersonaForm from "@components/PersonaForm";

export const dynamic = "force-dynamic";

export default async function PersonaEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const persona = await filePersonaRepository.getPersona(id);
  if (!persona) notFound();
  return <PersonaForm mode="edit" initial={persona} />;
}
