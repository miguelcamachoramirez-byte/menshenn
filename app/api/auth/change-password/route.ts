import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  getSession,
} from "@/lib/session";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/auth/change-password
// El usuario cambia su propia contrasena. Limpia mustChangePassword.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Debes ingresar la contrasena actual y la nueva." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "La nueva contrasena debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      return NextResponse.json(
        { error: "El usuario no existe." },
        { status: 404 }
      );
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "La contrasena actual no es correcta." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "La nueva contrasena debe ser diferente a la actual." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    // Renueva la sesion con el flag ya limpio
    const token = await createSessionToken({
      userId: updated.id,
      email: updated.email,
      role: updated.role,
      name: updated.name,
      position: updated.position,
      mustChangePassword: false,
    });
    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al cambiar contrasena:", error);
    return NextResponse.json(
      { error: "No se pudo cambiar la contrasena." },
      { status: 500 }
    );
  }
}
