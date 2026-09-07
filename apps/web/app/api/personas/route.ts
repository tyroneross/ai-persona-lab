import { NextResponse } from "next/server";
import type { PersonaFilters, PersonaStatus, SourceType } from "@lib/persona";
import { filePersonaRepository } from "@lib/persona-repository.server";
import { normalizePersonaInput } from "@lib/persona-validation";

export const dynamic = "force-dynamic";

function csv(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function filtersFromUrl(url: string): PersonaFilters {
  const params = new URL(url).searchParams;
  return {
    search: params.get("search") ?? undefined,
    status: csv(params.get("status")) as PersonaStatus[],
    tags: csv(params.get("tags")),
    role: params.get("role") ?? undefined,
    minConfidence: params.has("minConfidence") ? Number(params.get("minConfidence")) : undefined,
    sourceType: csv(params.get("sourceType")) as SourceType[],
  };
}

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: {
        code: status === 404 ? "not_found" : "validation_error",
        message: error instanceof Error ? error.message : "Persona request failed.",
      },
    },
    { status },
  );
}

export async function GET(request: Request) {
  const personas = await filePersonaRepository.listPersonas(filtersFromUrl(request.url));
  return NextResponse.json({ personas });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const persona = await filePersonaRepository.createPersona(
      normalizePersonaInput(body.persona ?? body),
    );
    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
