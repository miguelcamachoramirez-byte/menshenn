import { NextResponse } from "next/server";
import { requireAdmin, getSession } from "@/lib/session";
import {
  getPublicTraining,
  setTrainingActive,
  updateTraining,
  deleteTraining,
} from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id -> datos de la capacitacion (PUBLICO)
// ?c= convocatoria, ?key= clave, ?preview=1 vista previa (solo admin).
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const preview = url.searchParams.get("preview") === "1";

    if (preview) {
      const session = await getSession();
      if (!session || session.role !== "admin") {
        return NextResponse.json(
          { error: "Vista previa solo para administradores." },
          { status: 403 }
        );
      }
    }

    const data = await getPublicTraining(params.id, {
      cohortId: url.searchParams.get("c"),
      key: url.searchParams.get("key"),
      preview,
    });
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "No se pudo obtener la capacitacion.");
  }
}

// PATCH /api/trainings/:id -> activa/desactiva la capacitacion (solo admin)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();
    const training = await setTrainingActive(params.id, Boolean(body?.active));
    return NextResponse.json(training);
  } catch (error) {
    return handleRouteError(error, "No se pudo actualizar.");
  }
}

// PUT /api/trainings/:id -> edita una capacitacion (solo admin)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();
    const result = await updateTraining(params.id, body);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "No se pudo editar la capacitacion.");
  }
}

// DELETE /api/trainings/:id -> elimina capacitacion (solo admin)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    return NextResponse.json(await deleteTraining(params.id));
  } catch (error) {
    return handleRouteError(error, "No se pudo eliminar la capacitacion.");
  }
}
