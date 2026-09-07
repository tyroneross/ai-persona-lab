import type { PersonaSummary } from "@lib/persona";
import PersonaCard from "./PersonaCard";

export default function PersonaList({ personas }: { personas: PersonaSummary[] }) {
  return (
    <section aria-labelledby="personas-heading">
      <header className="mb-6">
        <h1 id="personas-heading" className="text-2xl font-semibold text-ink">
          Personas
        </h1>
        <p className="text-sm text-muted mt-1">
          {personas.length} {personas.length === 1 ? "persona" : "personas"} on file.
        </p>
      </header>
      <ul
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="list"
      >
        {personas.map((p) => (
          <li key={p.id}>
            <PersonaCard persona={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}
