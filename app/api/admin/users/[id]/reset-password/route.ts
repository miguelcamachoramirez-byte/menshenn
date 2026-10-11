import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// Genera una contrasena temporal legible
function generateTempPassword(length = 12) {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// POST /api/admin/users/:id/reset-password
// El admin genera una nueva contrasena temporal; el usuario debera cambiarla al entrar.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: "Falta el identificador del usuario." },
        { status: 400 }
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    // Devuelve la contrasena temporal UNA vez para que el admin la entregue
    return NextResponse.json({ tempPassword });
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
    console.error("Error al restablecer contrasena:", error);
    return NextResponse.json(
      { error: "No se pudo restablecer la contrasena." },
      { status: 500 }
    );
  }
}
