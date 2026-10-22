import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { registerAttendance } from "@modules/trainings/trainings.service";
import { handleRouteError } from "@modules/trainings/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/attendance -> asistencias de toda la capacitacion
// (solo admin). El detalle por convocatoria esta en /cohorts/:id/attendance.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const attendances = await prisma.trainingAttendance.findMany({
      where: { trainingId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(attendances);
  } catch (error) {
    return handleRouteError(error, "No se pudieron obtener las asistencias.");
  }
}

// POST /api/trainings/:id/attendance -> registra asistencia (PUBLICO)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const attendance = await registerAttendance(params.id, body);
    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "No se pudo registrar la asistencia.");
  }
}
