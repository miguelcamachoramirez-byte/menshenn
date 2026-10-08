import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/recipients -> lista destinatarios
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

// POST /api/recipients -> crea un destinatario
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const idNumber = String(body?.idNumber ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const area = body?.area ? String(body.area).trim() : null;

    if (!idNumber || !name) {
      return NextResponse.json(
        { error: "La cedula y el nombre son obligatorios." },
        { status: 400 }
      );
    }

    // Evita registrar dos veces a la misma persona
    const existing = await prisma.recipient.findUnique({ where: { idNumber } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un destinatario con esa cedula." },
        { status: 409 }
      );
    }

    const recipient = await prisma.recipient.create({
      data: { idNumber, name, area },
    });

    return NextResponse.json(recipient, { status: 201 });
  } catch (error) {
    console.error("Error al crear destinatario:", error);
    return NextResponse.json(
      { error: "No se pudo crear el destinatario." },
      { status: 500 }
    );
  }
}
