import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id -> datos de la capacitacion (PUBLICO)
// Si tiene clave de acceso, solo entrega el contenido cuando ?key= coincide.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const training = await prisma.training.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        embedUrl: true,
        fileUrl: true,
        minMinutes: true,
        requireAttendance: true,
        accessKey: true,
        active: true,
        questions: {
          orderBy: { orden: "asc" },
          select: { id: true, question: true, options: true },
        },
      },
    });

    if (!training) {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }

    const url = new URL(request.url);
    const providedKey = url.searchParams.get("key");
    const needsKey = Boolean(training.accessKey);
    const keyOk = !needsKey || providedKey === training.accessKey;

    // Si requiere clave y no coincide: solo metadatos minimos, sin contenido
    if (!keyOk) {
      return NextResponse.json({
        id: training.id,
        title: training.title,
        description: training.description,
        requiresKey: true,
        active: training.active,
        locked: true,
      });
    }

    // Acceso concedido: entrega todo
    return NextResponse.json({
      id: training.id,
      title: training.title,
      description: training.description,
      content: training.content,
      embedUrl: training.embedUrl,
      fileUrl: training.fileUrl,
      minMinutes: training.minMinutes,
      requireAttendance: training.requireAttendance,
      requiresKey: needsKey,
      active: training.active,
      locked: false,
      questions: training.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options) as string[],
      })),
    });
  } catch (error) {
    console.error("Error al obtener capacitacion:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la capacitacion." },
      { status: 500 }
    );
  }
}

// PATCH /api/trainings/:id -> acciones rapidas (solo admin)
//  - { active } -> activa/desactiva registros
//  - { action: "rotateGroup", groupLabel, accessKey } -> inicia nuevo grupo:
//    cambia la clave (bloquea al grupo anterior) y etiqueta la nueva tanda.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();

    // Rotacion de grupo/convocatoria
    if (body?.action === "rotateGroup") {
      const groupLabel = String(body?.groupLabel ?? "").trim();
      const accessKey = body?.accessKey ? String(body.accessKey).trim() : null;
      if (!groupLabel) {
        return NextResponse.json(
          { error: "El nombre del grupo es obligatorio." },
          { status: 400 }
        );
      }
      const training = await prisma.training.update({
        where: { id: params.id },
        data: { groupLabel, accessKey, active: true },
        select: { id: true, groupLabel: true, active: true },
      });
      return NextResponse.json(training);
    }

    // Activar/desactivar registros
    const active = Boolean(body?.active);
    const training = await prisma.training.update({
      where: { id: params.id },
      data: { active },
      select: { id: true, active: true },
    });
    return NextResponse.json(training);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }
    console.error("Error al actualizar capacitacion:", error);
    return NextResponse.json(
      { error: "No se pudo actualizar." },
      { status: 500 }
    );
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
    const title = String(body?.title ?? "").trim();
    const description = body?.description
      ? String(body.description).trim()
      : null;
    const content = body?.content ? String(body.content).trim() : null;
    const embedUrl = body?.embedUrl ? String(body.embedUrl).trim() : null;
    const fileUrl = body?.fileUrl ? String(body.fileUrl).trim() : null;
    const minMinutes = Math.max(0, Number(body?.minMinutes) || 0);
    const requireAttendance = body?.requireAttendance !== false;
    const accessKey = body?.accessKey ? String(body.accessKey).trim() : null;
    const groupLabel = body?.groupLabel ? String(body.groupLabel).trim() : null;
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

    // Actualiza la capacitacion y reemplaza las preguntas
    await prisma.$transaction([
      prisma.trainingQuestion.deleteMany({ where: { trainingId: params.id } }),
      prisma.training.update({
        where: { id: params.id },
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
          questions: { create: questions as any[] },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }
    console.error("Error al editar capacitacion:", error);
    return NextResponse.json(
      { error: "No se pudo editar la capacitacion." },
      { status: 500 }
    );
  }
}

// DELETE /api/trainings/:id -> elimina capacitacion (solo admin)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    await prisma.training.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }
    console.error("Error al eliminar capacitacion:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la capacitacion." },
      { status: 500 }
    );
  }
}
