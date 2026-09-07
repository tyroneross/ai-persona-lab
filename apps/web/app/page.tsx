import { filePersonaRepository } from "@lib/persona-repository.server";
import PersonaList from "@components/PersonaList";
import EmptyState from "@components/EmptyState";

export const dynamic = "force-dynamic";

export default async function PersonasIndexPage() {
  const personas = await filePersonaRepository.listPersonas();

  if (personas.length === 0) {
    return (
      <EmptyState
        title="No personas yet"
        body="Create your first persona to start building a shared view of who you are designing for."
        ctaHref="/personas/new"
        ctaLabel="Create persona"
      />
    );
  }

  return <PersonaList personas={personas} />;
}
