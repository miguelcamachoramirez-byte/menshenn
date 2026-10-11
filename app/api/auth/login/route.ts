import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contrasena son obligatorios." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Mensaje generico para no revelar si el email existe
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales invalidas." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Credenciales invalidas." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      position: user.position,
      mustChangePassword: user.mustChangePassword,
    });

    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        position: user.position,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar sesion." },
      { status: 500 }
    );
  }
}
