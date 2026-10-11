import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/admin/users -> lista usuarios (sin el hash de contrasena)
export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al listar usuarios:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los usuarios." },
      { status: 500 }
    );
  }
}

// POST /api/admin/users -> crea un usuario
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = body?.name ? String(body.name).trim() : null;
    const position = body?.position ? String(body.position).trim() : null;
    const password = String(body?.password ?? "");
    const role = body?.role === "admin" ? "admin" : "user";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contrasena son obligatorios." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El email no tiene un formato valido." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      // Debe cambiar la contrasena temporal en su primer ingreso
      data: { email, name, position, passwordHash, role, mustChangePassword: true },
      select: {
        id: true,
        email: true,
        name: true,
        position: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error al crear usuario:", error);
    return NextResponse.json(
      { error: "No se pudo crear el usuario." },
      { status: 500 }
    );
  }
}
