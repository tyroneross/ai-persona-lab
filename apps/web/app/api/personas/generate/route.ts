import { NextResponse } from "next/server";
import { generatePersona } from "@lib/persona-generate.server";

export const dynamic = "force-dynamic";
// Local model generation can take a while on first load.
export const maxDuration = 130;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const instruction = String(body?.instruction ?? "");
    const result = await generatePersona(instruction);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "generation_error",
          message: error instanceof Error ? error.message : "Persona generation failed.",
        },
      },
      { status: 400 },
    );
  }
}
