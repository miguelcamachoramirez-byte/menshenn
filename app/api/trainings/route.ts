import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listTrainings, createTraining } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// GET /api/trainings -> lista capacitaciones (solo admin)
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listTrainings());
  } catch (error) {
    return handleRouteError(error, "No se pudieron obtener las capacitaciones.");
  }
}

// POST /api/trainings -> crea una capacitacion (solo admin)
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const training = await createTraining(body);
    return NextResponse.json(training, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "No se pudo crear la capacitacion.");
  }
}
