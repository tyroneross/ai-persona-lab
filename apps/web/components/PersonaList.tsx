import type { PersonaSummary } from "@lib/persona";
import PersonaCard from "./PersonaCard";

export default function PersonaList({ personas }: { personas: PersonaSummary[] }) {
  return (
    <section aria-labelledby="personas-heading" className="space-y-8">
      <header className="hero-band">
        <p className="eyebrow">Persona library</p>
        <h1 id="personas-heading" className="mt-3 text-title text-ink">
          Personas
        </h1>
        <p className="mt-3 text-body text-muted">
          {personas.length} {personas.length === 1 ? "persona" : "personas"} on file.
        </p>
      </header>
      <ul
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
