import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  Persona,
  PersonaCreateInput,
  PersonaExport,
  PersonaFilters,
  PersonaUpdateInput,
  SchemaVersion,
} from "./persona";
import type { PersonaRepository } from "./repository";
import { matchesPersonaFilters, toPersonaSummary } from "./repository";
import { personaId } from "./id";
import { assertValidPersona } from "./persona-validation";

const SCHEMA_VERSION: SchemaVersion = "1.1.0";

type PersonaFile = {
  schema_version: SchemaVersion;
  personas: Persona[];
};

/**
 * The persona library is shared with the `persona` CLI and coding agents.
 * Default: ~/.persona-lab (global, recallable from any repo).
 * Override with PERSONA_LAB_HOME (e.g. point at the repo's data/ for local-only).
 */
const libraryHome = process.env.PERSONA_LAB_HOME
  ? path.resolve(process.env.PERSONA_LAB_HOME)
  : path.join(os.homedir(), ".persona-lab");
const personasPath = path.join(libraryHome, "personas.json");

function emptyFile(): PersonaFile {
  return { schema_version: SCHEMA_VERSION, personas: [] };
}

async function readPersonaFile(): Promise<PersonaFile> {
  try {
    const parsed = JSON.parse(await readFile(personasPath, "utf8")) as PersonaFile;
    return {
      schema_version: parsed.schema_version ?? SCHEMA_VERSION,
      personas: Array.isArray(parsed.personas) ? parsed.personas : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFile();
    throw error;
  }
}

async function writePersonaFile(file: PersonaFile): Promise<void> {
  file.personas.forEach(assertValidPersona);
  await mkdir(libraryHome, { recursive: true });
  const tempPath = `${personasPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`);
  await rename(tempPath, personasPath);
}

export const filePersonaRepository: PersonaRepository = {
  async listPersonas(filters: PersonaFilters = {}) {
    const file = await readPersonaFile();
    return file.personas
      .filter((persona) => matchesPersonaFilters(persona, filters))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(toPersonaSummary);
  },

  async getPersona(id: string) {
    const file = await readPersonaFile();
    return file.personas.find((persona) => persona.id === id) ?? null;
  },

  async createPersona(input: PersonaCreateInput) {
    const file = await readPersonaFile();
    const now = new Date().toISOString();
    const persona: Persona = {
      ...input,
      schema_version: SCHEMA_VERSION,
      id: personaId(input.name),
      created_at: now,
      updated_at: now,
    };
    assertValidPersona(persona);
    file.personas.unshift(persona);
    await writePersonaFile(file);
    return persona;
  },

  async updatePersona(id: string, input: PersonaUpdateInput) {
    const file = await readPersonaFile();
    const index = file.personas.findIndex((persona) => persona.id === id);
    if (index === -1) throw new Error(`Persona ${id} not found.`);
    const updated: Persona = {
      ...file.personas[index],
      ...input,
      id,
      schema_version: SCHEMA_VERSION,
      created_at: file.personas[index].created_at,
      updated_at: new Date().toISOString(),
    };
    assertValidPersona(updated);
    file.personas[index] = updated;
    await writePersonaFile(file);
    return updated;
  },

  async archivePersona(id: string) {
    return this.updatePersona(id, { status: "archived" });
  },

  async exportPersonas(ids?: string[]): Promise<PersonaExport> {
    const file = await readPersonaFile();
    const personas = ids
      ? file.personas.filter((persona) => ids.includes(persona.id))
      : file.personas;
    return { schema_version: SCHEMA_VERSION, personas };
  },
};
