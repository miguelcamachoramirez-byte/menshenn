import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/trainings/:id/verify -> verifica el cuestionario SIN registrar (PUBLICO)
// Devuelve { passed: boolean, wrong: string[] } con los ids de preguntas erradas.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const training = await prisma.training.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        questions: { select: { id: true, correct: true } },
      },
    });
    if (!training) {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const answers = body?.answers ?? {};

    const wrong = training.questions
      .filter((q) => Number(answers?.[q.id]) !== q.correct)
      .map((q) => q.id);

    return NextResponse.json({ passed: wrong.length === 0, wrong });
  } catch (error) {
    console.error("Error al verificar cuestionario:", error);
    return NextResponse.json(
      { error: "No se pudo verificar el cuestionario." },
      { status: 500 }
    );
  }
}
