import { NextResponse } from "next/server";
import { verifyQuiz } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// POST /api/trainings/:id/verify -> verifica el cuestionario SIN registrar (PUBLICO)
// Devuelve { passed: boolean, wrong: string[] }.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const result = await verifyQuiz(params.id, body?.answers ?? {});
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "No se pudo verificar el cuestionario.");
  }
}
