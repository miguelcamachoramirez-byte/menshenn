import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE, type SessionPayload } from "@/lib/auth";

// Devuelve la sesion actual (o null) leyendo la cookie en el servidor
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// Lanza si no hay sesion o no es admin. Util en rutas de API de administracion.
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("No autorizado.", 401);
  }
  if (session.role !== "admin") {
    throw new AuthError("Requiere permisos de administrador.", 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
