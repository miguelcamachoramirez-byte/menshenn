import { SignJWT, jwtVerify } from "jose";

// Payload que guardamos dentro del token de sesion
export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
  name?: string | null;
  position?: string | null;
};

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET no esta definido o es demasiado corto. Revisa tu archivo .env"
    );
  }
  return new TextEncoder().encode(secret);
}

// Crea un JWT firmado con los datos de sesion
export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

// Verifica un JWT y devuelve el payload, o null si es invalido/expirado
export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      role: String(payload.role),
      name: (payload.name as string | undefined) ?? null,
      position: (payload.position as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
