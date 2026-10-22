import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { updateCohort, deleteCohort } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// PATCH /api/trainings/:id/cohorts/:cohortId (solo admin)
//  - { active } abre/cierra; { name, accessKey } edita datos.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();
    const cohort = await updateCohort(params.cohortId, body);
    return NextResponse.json(cohort);
  } catch (error) {
    return handleRouteError(error, "No se pudo actualizar la convocatoria.");
  }
}

// DELETE /api/trainings/:id/cohorts/:cohortId -> elimina la convocatoria
// y sus asistencias (solo admin).
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    return NextResponse.json(await deleteCohort(params.cohortId));
  } catch (error) {
    return handleRouteError(error, "No se pudo eliminar la convocatoria.");
  }
}
