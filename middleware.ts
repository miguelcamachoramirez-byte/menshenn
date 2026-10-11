import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// Rutas publicas que no requieren sesion
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const isAdminArea =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/api/dashboard") ||
    pathname === "/recipients" ||
    pathname.startsWith("/recipients/");

  // API protegida -> responde 401/403 en JSON
  if (pathname.startsWith("/api/")) {
    if (isPublic) return NextResponse.next();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
    if (isAdminArea && session.role !== "admin") {
      return NextResponse.json(
        { error: "Requiere permisos de administrador." },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Paginas
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Area de admin: si no es admin, de vuelta al inicio
  if (session && isAdminArea && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si ya tiene sesion y va al login, mandalo al inicio
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si debe cambiar la contrasena, forzar la pagina de cambio
  if (session?.mustChangePassword) {
    const allowed =
      pathname === "/cambiar-contrasena" ||
      pathname === "/api/auth/change-password" ||
      pathname === "/api/auth/logout" ||
      pathname === "/api/auth/me";
    if (!allowed) {
      return NextResponse.redirect(
        new URL("/cambiar-contrasena", request.url)
      );
    }
  }

  // Si NO debe cambiarla pero intenta entrar a esa pagina, mandalo al inicio
  if (
    session &&
    !session.mustChangePassword &&
    pathname === "/cambiar-contrasena"
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Aplica a todo menos archivos estaticos y assets de Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
