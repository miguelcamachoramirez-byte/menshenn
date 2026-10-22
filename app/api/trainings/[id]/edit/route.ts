import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getTrainingForEdit } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/edit -> datos completos para editar (solo admin)
// Incluye clave y respuestas correctas (que NO se exponen al publico).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    return NextResponse.json(await getTrainingForEdit(params.id));
  } catch (error) {
    return handleRouteError(error, "No se pudo obtener la capacitacion.");
  }
}
