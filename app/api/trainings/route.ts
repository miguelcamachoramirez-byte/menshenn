import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings -> lista capacitaciones (solo admin) con conteo de asistencias
export async function GET() {
  try {
    await requireAdmin();
    const trainings = await prisma.training.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { attendances: true } },
      },
    });
    // Indica si tiene clave sin exponer el valor
    const result = trainings.map((t) => ({
      ...t,
      hasAccessKey: Boolean(t.accessKey),
      accessKey: undefined,
    }));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al listar capacitaciones:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las capacitaciones." },
      { status: 500 }
    );
  }
}

// POST /api/trainings -> crea una capacitacion (solo admin)
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const title = String(body?.title ?? "").trim();
    const description = body?.description
      ? String(body.description).trim()
      : null;
    const content = body?.content ? String(body.content).trim() : null;
    const embedUrl = body?.embedUrl ? String(body.embedUrl).trim() : null;
    const fileUrl = body?.fileUrl ? String(body.fileUrl).trim() : null;
    const minMinutes = Math.max(0, Number(body?.minMinutes) || 0);
    const requireAttendance = body?.requireAttendance !== false; // por defecto true
    const accessKey = body?.accessKey ? String(body.accessKey).trim() : null;
    const groupLabel = body?.groupLabel ? String(body.groupLabel).trim() : null;

    // Preguntas opcionales del cuestionario
    // Formato esperado: [{ question, options: string[], correct: number }]
    const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];

    if (!title) {
      return NextResponse.json(
        { error: "El titulo es obligatorio." },
        { status: 400 }
      );
    }

    if (!content && !embedUrl && !fileUrl) {
      return NextResponse.json(
        { error: "Agrega contenido, un enlace o un archivo PDF." },
        { status: 400 }
      );
    }

    // Valida y normaliza las preguntas
    const questions = rawQuestions
      .map((q: any, i: number) => {
        const question = String(q?.question ?? "").trim();
        const options = Array.isArray(q?.options)
          ? q.options.map((o: any) => String(o).trim()).filter(Boolean)
          : [];
        const correct = Number(q?.correct);
        if (!question || options.length < 2) return null;
        if (Number.isNaN(correct) || correct < 0 || correct >= options.length) {
          return null;
        }
        return {
          question,
          options: JSON.stringify(options),
          correct,
          orden: i,
        };
      })
      .filter(Boolean);

    const training = await prisma.training.create({
      data: {
        title,
        description,
        content,
        embedUrl,
        fileUrl,
        minMinutes,
        requireAttendance,
        accessKey: requireAttendance ? accessKey : null,
        groupLabel: requireAttendance ? groupLabel : null,
        questions: {
          create: questions as any[],
        },
      },
    });

    return NextResponse.json(training, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al crear capacitacion:", error);
    return NextResponse.json(
      { error: "No se pudo crear la capacitacion." },
      { status: 500 }
    );
  }
}
