import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/attendance -> lista de asistencias (solo admin)
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

// POST /api/trainings/:id/attendance -> registra asistencia (PUBLICO)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const training = await prisma.training.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        active: true,
        requireAttendance: true,
        questions: {
          select: { id: true, correct: true },
        },
      },
    });
    if (!training) {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const fullName = String(body?.fullName ?? "").trim();
    const idNumber = String(body?.idNumber ?? "").trim();
    const company = body?.company ? String(body.company).trim() : null;
    const position = body?.position ? String(body.position).trim() : null;
    const accessKey = body?.accessKey ? String(body.accessKey) : null;
    const cohortId = body?.cohortId ? String(body.cohortId) : null;
    // Respuestas del cuestionario: { [questionId]: indiceSeleccionado }
    const answers = body?.answers ?? {};

    // Debe venir una convocatoria valida y abierta
    if (!cohortId) {
      return NextResponse.json(
        { error: "No se indico la convocatoria." },
        { status: 400 }
      );
    }
    const cohort = await prisma.trainingCohort.findFirst({
      where: { id: cohortId, trainingId: training.id },
      select: { id: true, accessKey: true, active: true },
    });
    if (!cohort) {
      return NextResponse.json(
        { error: "La convocatoria no existe." },
        { status: 404 }
      );
    }
    if (!cohort.active) {
      return NextResponse.json(
        { error: "Esta convocatoria esta cerrada." },
        { status: 400 }
      );
    }

    // Valida clave de acceso de la convocatoria (si tiene)
    if (cohort.accessKey && accessKey !== cohort.accessKey) {
      return NextResponse.json(
        { error: "Clave de acceso incorrecta." },
        { status: 403 }
      );
    }

    if (!fullName || !idNumber) {
      return NextResponse.json(
        { error: "El nombre y la cedula son obligatorios." },
        { status: 400 }
      );
    }

    // Si la capacitacion tiene cuestionario, valida que TODAS sean correctas
    const hasQuiz = training.questions.length > 0;
    if (hasQuiz) {
      const allCorrect = training.questions.every(
        (q) => Number(answers?.[q.id]) === q.correct
      );
      if (!allCorrect) {
        return NextResponse.json(
          {
            error:
              "Algunas respuestas son incorrectas. Revisa el contenido e intenta de nuevo.",
          },
          { status: 400 }
        );
      }
    }

    // Evita registros duplicados de la misma persona dentro de la MISMA
    // convocatoria. La misma cedula si puede registrarse en otra convocatoria.
    const existing = await prisma.trainingAttendance.findFirst({
      where: { cohortId: cohort.id, idNumber },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya registraste tu asistencia a esta convocatoria." },
        { status: 409 }
      );
    }

    const attendance = await prisma.trainingAttendance.create({
      data: {
        trainingId: params.id,
        cohortId: cohort.id,
        fullName,
        idNumber,
        company,
        position,
        passedQuiz: hasQuiz,
      },
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    return NextResponse.json(
      { error: "No se pudo registrar la asistencia." },
      { status: 500 }
    );
  }
}
