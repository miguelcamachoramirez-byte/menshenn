import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE /api/recipients/:id -> elimina un destinatario
export async function DELETE(
  _request: Request,
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
        { error: "Falta el identificador del destinatario." },
        { status: 400 }
      );
    }

    await prisma.recipient.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "El destinatario no existe." },
        { status: 404 }
      );
    }
    console.error("Error al eliminar destinatario:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el destinatario." },
      { status: 500 }
    );
  }
}
