import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/edit -> datos completos para editar (solo admin)
// Incluye la clave y las respuestas correctas (que NO se exponen al publico).
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const training = await prisma.training.findUnique({
      where: { id: params.id },
      include: {
        questions: {
          orderBy: { orden: "asc" },
          select: { question: true, options: true, correct: true },
        },
      },
    });
    if (!training) {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      id: training.id,
      title: training.title,
      description: training.description,
      content: training.content,
      embedUrl: training.embedUrl,
      fileUrl: training.fileUrl,
      minMinutes: training.minMinutes,
      requireAttendance: training.requireAttendance,
      accessKey: training.accessKey,
      groupLabel: training.groupLabel,
      questions: training.questions.map((q) => ({
        question: q.question,
        options: JSON.parse(q.options) as string[],
        correct: q.correct,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al obtener capacitacion para editar:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la capacitacion." },
      { status: 500 }
    );
  }
}
