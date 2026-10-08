import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Evita cacheo: siempre datos frescos
export const dynamic = "force-dynamic";

// GET /api/reports -> lista todos los reportes
export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        recipients: {
          select: { id: true, name: true, area: true },
        },
      },
    });
    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error al listar reportes:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los reportes." },
      { status: 500 }
    );
  }
}

// POST /api/reports -> crea un reporte
// El autor se toma de la sesion (no se confia en el cliente).
// El destinatario se elige de la tabla de destinatarios por su id.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
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

    // Verifica que todos los destinatarios existan
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

    // El autor es la persona logueada
    const author = session.name || session.email;
    // Resumen legible de destinatarios para mostrar/exportar
    const summary = found.map((r) => r.name).join(", ");

    const report = await prisma.report.create({
      data: {
        author,
        recipient: summary,
        reportDate: parsedDate,
        content: content ? String(content).trim() : null,
        recipients: { connect: ids.map((id) => ({ id })) },
      },
      include: {
        recipients: { select: { id: true, name: true, area: true } },
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Error al crear reporte:", error);
    return NextResponse.json(
      { error: "No se pudo crear el reporte." },
      { status: 500 }
    );
  }
}
