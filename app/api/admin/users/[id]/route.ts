import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE /api/admin/users/:id -> elimina un usuario
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdmin();
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el identificador del usuario." },
        { status: 400 }
      );
    }

    // Evita que el admin se elimine a si mismo y quede fuera del sistema
    if (id === session.userId) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta." },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "El usuario no existe." },
        { status: 404 }
      );
    }
    console.error("Error al eliminar usuario:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el usuario." },
      { status: 500 }
    );
  }
}
