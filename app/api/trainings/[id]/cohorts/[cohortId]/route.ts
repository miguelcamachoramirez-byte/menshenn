import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/cohorts/:cohortId/attendance se maneja aparte.
// Aqui: PATCH para activar/cerrar o editar; DELETE para eliminar.

// PATCH /api/trainings/:id/cohorts/:cohortId (solo admin)
//  - { active } -> abre/cierra registros de la convocatoria
//  - { name, accessKey } -> edita datos de la convocatoria
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();

    const data: {
      active?: boolean;
      name?: string;
      accessKey?: string | null;
    } = {};

    if (typeof body?.active === "boolean") data.active = body.active;
    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "El nombre no puede quedar vacio." },
          { status: 400 }
        );
      }
      data.name = name;
    }
    if (body?.accessKey !== undefined) {
      const key = body.accessKey ? String(body.accessKey).trim() : "";
      data.accessKey = key || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No hay cambios para aplicar." },
        { status: 400 }
      );
    }

    const cohort = await prisma.trainingCohort.update({
      where: { id: params.cohortId },
      data,
      include: { _count: { select: { attendances: true } } },
    });

    return NextResponse.json({
      id: cohort.id,
      name: cohort.name,
      active: cohort.active,
      hasAccessKey: Boolean(cohort.accessKey),
      accessKey: cohort.accessKey,
      createdAt: cohort.createdAt,
      attendances: cohort._count.attendances,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "La convocatoria no existe." },
        { status: 404 }
      );
    }
    console.error("Error al actualizar convocatoria:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la convocatoria." },
      { status: 500 }
    );
  }
}

// DELETE /api/trainings/:id/cohorts/:cohortId -> elimina la convocatoria
// (y sus asistencias, por la relacion). Solo admin.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    // Elimina primero las asistencias de la convocatoria, luego la convocatoria
    await prisma.$transaction([
      prisma.trainingAttendance.deleteMany({
        where: { cohortId: params.cohortId },
      }),
      prisma.trainingCohort.delete({ where: { id: params.cohortId } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "La convocatoria no existe." },
        { status: 404 }
      );
    }
    console.error("Error al eliminar convocatoria:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la convocatoria." },
      { status: 500 }
    );
  }
}
