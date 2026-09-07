import type {
  Persona,
  PersonaExport,
  PersonaFilters,
  PersonaSummary,
} from "./persona";

/**
 * Repository contract from docs/architecture.md.
 * Storage implementations live outside this shared contract.
 */
export type PersonaRepository = {
  listPersonas(filters?: PersonaFilters): Promise<PersonaSummary[]>;
  getPersona(id: string): Promise<Persona | null>;
  createPersona(input: Omit<Persona, "id" | "schema_version" | "created_at" | "updated_at">): Promise<Persona>;
  updatePersona(id: string, input: Partial<Omit<Persona, "id" | "schema_version" | "created_at" | "updated_at">>): Promise<Persona>;
  archivePersona(id: string): Promise<Persona>;
  exportPersonas(ids?: string[]): Promise<PersonaExport>;
};

export function toPersonaSummary(p: Persona): PersonaSummary {
  return {
    id: p.id,
    status: p.status,
    name: p.name,
    archetype: p.archetype,
    role: p.role,
    summary: p.summary,
    primary_goal: p.primary_goal,
    confidence: p.confidence,
    tags: p.tags,
    updated_at: p.updated_at,
  };
}

export function matchesPersonaFilters(p: Persona, filters: PersonaFilters): boolean {
  if (filters.status && filters.status.length > 0 && !filters.status.includes(p.status)) {
    return false;
  }
  if (filters.role && p.role.toLowerCase() !== filters.role.toLowerCase()) {
    return false;
  }
  if (typeof filters.minConfidence === "number" && p.confidence < filters.minConfidence) {
    return false;
  }
  if (filters.tags && filters.tags.length > 0) {
    const set = new Set(p.tags.map((t) => t.toLowerCase()));
    const wanted = filters.tags.map((t) => t.toLowerCase());
    if (!wanted.every((t) => set.has(t))) return false;
  }
  if (filters.sourceType && filters.sourceType.length > 0) {
    const present = new Set(p.evidence.map((e) => e.source_type));
    if (!filters.sourceType.some((t) => present.has(t))) return false;
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = [p.name, p.archetype, p.role, p.summary, p.primary_goal, ...p.tags]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
