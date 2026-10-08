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
    const { recipientIds, reportDate, content } = body ?? {};

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

    const report = await prisma.report.update({
      where: { id },
      data: {
        recipient: summary,
        reportDate: parsedDate,
        content: content ? String(content).trim() : null,
        editedAt: new Date(),
        editedBy,
        // Reemplaza los destinatarios por los nuevos
        recipients: { set: ids.map((rid) => ({ id: rid })) },
      },
      include: {
        recipients: { select: { id: true, name: true, area: true } },
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

// DELETE /api/reports/:id -> elimina un reporte
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
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
