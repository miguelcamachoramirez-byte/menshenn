import { NextResponse } from "next/server";
import { AuthError } from "@/lib/session";
import { ServiceError } from "./trainings.service";

// Convierte errores conocidos (auth, dominio, Prisma) en respuestas JSON.
// Centraliza el manejo de errores de todas las rutas del modulo.
export function handleRouteError(error: unknown, fallback: string) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if ((error as any)?.code === "P2025") {
    return NextResponse.json(
      { error: "El registro no existe." },
      { status: 404 }
    );
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
