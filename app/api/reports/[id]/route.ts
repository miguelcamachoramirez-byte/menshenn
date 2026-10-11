import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// PUT /api/reports/:id -> edita un reporte y marca que fue editado
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Falta el identificador del reporte." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { recipientIds, reportDate, content, imageUrl } = body ?? {};

    const ids: string[] = Array.isArray(recipientIds)
      ? recipientIds.map((x: unknown) => String(x))
      : [];

    if (ids.length === 0 || !reportDate) {
      return NextResponse.json(
        { error: "Debes elegir al menos un destinatario y una fecha." },
        { status: 400 }
      );
    }

    const parsedDate = new Date(reportDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "La fecha proporcionada no es valida." },
        { status: 400 }
      );
    }

    // Solo el autor del reporte (o un admin) puede editarlo
    const existing = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        recipient: true,
        reportDate: true,
        content: true,
        imageUrl: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "El reporte no existe." },
        { status: 404 }
      );
    }
    // Solo el autor del reporte puede editarlo (ni siquiera el admin)
    const isOwner = existing.authorId === session.userId;
    if (!isOwner) {
      return NextResponse.json(
        { error: "Solo puedes editar los reportes que tu creaste." },
        { status: 403 }
      );
    }

    const found = await prisma.recipient.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    if (found.length !== ids.length) {
      return NextResponse.json(
        { error: "Uno o mas destinatarios seleccionados no existen." },
        { status: 400 }
      );
    }

    const summary = found.map((r) => r.name).join(", ");
    const editedBy = session.name || session.email;
    const now = new Date();
    const newContent = content ? String(content).trim() : null;

    // Operaciones secuenciales (sin transaccion interactiva, que no es
    // compatible con el pooler "transaction" de Supabase y agota el pool).

    // 1) Guarda en la traza el estado PREVIO del reporte (version anterior).
    await prisma.reportEdit.create({
      data: {
        reportId: id,
        editedBy,
        editedAt: now,
        recipient: existing.recipient,
        reportDate: existing.reportDate,
        content: existing.content,
        imageUrl: existing.imageUrl,
      },
    });

    // 2) Actualiza el reporte a su nuevo estado.
    await prisma.report.update({
      where: { id },
      data: {
        recipient: summary,
        reportDate: parsedDate,
        content: newContent,
        imageUrl: imageUrl ? String(imageUrl) : null,
        editedAt: now,
        editedBy,
        recipients: { set: ids.map((rid) => ({ id: rid })) },
      },
    });

    // 3) Lee el reporte final con su traza.
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        recipients: { select: { id: true, name: true, area: true } },
        edits: {
          orderBy: { editedAt: "desc" },
          select: {
            id: true,
            editedBy: true,
            editedAt: true,
            recipient: true,
            reportDate: true,
            content: true,
            imageUrl: true,
          },
        },
      },
    });

    return NextResponse.json(report);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "El reporte no existe." },
        { status: 404 }
      );
    }
    console.error("Error al editar reporte:", error);
    return NextResponse.json(
      { error: "No se pudo editar el reporte." },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/:id -> elimina un reporte (solo admin)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Solo un administrador puede eliminar reportes." },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el identificador del reporte." },
        { status: 400 }
      );
    }

    await prisma.report.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // P2025 = registro no encontrado en Prisma
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "El reporte no existe." },
        { status: 404 }
      );
    }
    console.error("Error al eliminar reporte:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el reporte." },
      { status: 500 }
    );
  }
}
