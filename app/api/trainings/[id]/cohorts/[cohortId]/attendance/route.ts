import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listCohortAttendance } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/cohorts/:cohortId/attendance
// Asistencias de una convocatoria (solo admin).
export async function GET(
  _request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    return NextResponse.json(await listCohortAttendance(params.cohortId));
  } catch (error) {
    return handleRouteError(error, "No se pudieron obtener las asistencias.");
  }
}
