import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/cohorts/:cohortId/attendance
// Lista las asistencias de una convocatoria (solo admin).
export async function GET(
  _request: Request,
  { params }: { params: { id: string; cohortId: string } }
) {
  try {
    await requireAdmin();
    const attendances = await prisma.trainingAttendance.findMany({
      where: { cohortId: params.cohortId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(attendances);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al listar asistencias:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las asistencias." },
      { status: 500 }
    );
  }
}
