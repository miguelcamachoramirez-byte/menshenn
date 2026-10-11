import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/recipients -> lista destinatarios (cualquier logueado, para el formulario)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const recipients = await prisma.recipient.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(recipients);
  } catch (error) {
    console.error("Error al listar destinatarios:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los destinatarios." },
      { status: 500 }
    );
  }
}

// POST /api/recipients -> crea un destinatario (solo admin)
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const name = String(body?.name ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del tipo de riesgo es obligatorio." },
        { status: 400 }
      );
    }

    // Evita duplicados por nombre (case-insensitive)
    const existing = await prisma.recipient.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un tipo de riesgo con ese nombre." },
        { status: 409 }
      );
    }

    const recipient = await prisma.recipient.create({
      data: { name },
    });

    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al crear destinatario:", error);
    return NextResponse.json(
      { error: "No se pudo crear el destinatario." },
      { status: 500 }
    );
  }
}
