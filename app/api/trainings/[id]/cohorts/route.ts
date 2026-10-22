import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/trainings/:id/cohorts -> lista convocatorias (solo admin)
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const cohorts = await prisma.trainingCohort.findMany({
      where: { trainingId: params.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { attendances: true } } },
    });
    // No exponemos la clave en claro; solo si existe
    const result = cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
      hasAccessKey: Boolean(c.accessKey),
      accessKey: c.accessKey, // admin necesita verla para compartirla
      createdAt: c.createdAt,
      attendances: c._count.attendances,
    }));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al listar convocatorias:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las convocatorias." },
      { status: 500 }
    );
  }
}

// POST /api/trainings/:id/cohorts -> crea una convocatoria (solo admin)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    // Verifica que la capacitacion exista
    const training = await prisma.training.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!training) {
      return NextResponse.json(
        { error: "La capacitacion no existe." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const accessKey = body?.accessKey ? String(body.accessKey).trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre de la convocatoria es obligatorio." },
        { status: 400 }
      );
    }

    const cohort = await prisma.trainingCohort.create({
      data: { trainingId: params.id, name, accessKey, active: true },
    });

    return NextResponse.json(
      {
        id: cohort.id,
        name: cohort.name,
        active: cohort.active,
        hasAccessKey: Boolean(cohort.accessKey),
        accessKey: cohort.accessKey,
        createdAt: cohort.createdAt,
        attendances: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al crear convocatoria:", error);
    return NextResponse.json(
      { error: "No se pudo crear la convocatoria." },
      { status: 500 }
    );
  }
}
