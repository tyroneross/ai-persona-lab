import { NextResponse } from "next/server";
import { filePersonaRepository } from "@lib/persona-repository.server";
import { normalizePersonaInput } from "@lib/persona-validation";

export const dynamic = "force-dynamic";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const persona = await filePersonaRepository.getPersona(id);
  if (!persona) return errorResponse(new Error("Persona not found."), 404);
  return NextResponse.json({ persona });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await filePersonaRepository.getPersona(id);
    if (!existing) return errorResponse(new Error("Persona not found."), 404);
    const body = await request.json();
    const persona = await filePersonaRepository.updatePersona(
      id,
      normalizePersonaInput(body.persona ?? body, existing),
    );
    return NextResponse.json({ persona });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const persona = await filePersonaRepository.archivePersona(id);
    return NextResponse.json({ persona });
  } catch (error) {
    return errorResponse(error, error instanceof Error && error.message.includes("not found") ? 404 : 400);
  }
}
