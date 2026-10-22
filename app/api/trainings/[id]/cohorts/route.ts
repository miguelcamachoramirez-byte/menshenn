import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listCohorts, createCohort } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/cohorts -> lista convocatorias (solo admin)
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    return NextResponse.json(await listCohorts(params.id));
  } catch (error) {
    return handleRouteError(error, "No se pudieron obtener las convocatorias.");
  }
}

// POST /api/trainings/:id/cohorts -> crea una convocatoria (solo admin)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();
    const cohort = await createCohort(params.id, body);
    return NextResponse.json(cohort, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "No se pudo crear la convocatoria.");
  }
}
