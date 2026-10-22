"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "./components/Loader";
import {
  getVisibleModulesByArea,
  type AppModule,
} from "@modules/shared/modules.config";
import { roleLabel } from "@modules/shared/roles";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  position: string | null;
  role: string;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // el middleware ya protege la ruta
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <Loader text="Cargando..." />
      </main>
    );
  }

  const isAdmin = user?.role === "admin";
  const areas = getVisibleModulesByArea(isAdmin);

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">
          {user ? (
            <>
              Sesion de <strong>{user.name || user.email}</strong>
              {user.position && ` · ${user.position}`}
              {` · ${roleLabel(user.role)}`}
            </>
          ) : (
            "Bienvenido"
          )}
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Saliendo..." : "Cerrar sesion"}
          </button>
        </div>
      </div>

      <header className="header">
        <h1>Plataforma</h1>
        <p>Selecciona un modulo para comenzar.</p>
      </header>

      {areas.map((group) => (
        <section key={group.area} className="module-area">
          <h2 className="section-title">{group.area}</h2>
          <div className="module-grid">
            {group.modules.map((m: AppModule) => (
              <Link key={m.id} href={m.href} className="module-card">
                <span className="module-icon" aria-hidden="true">
                  {m.icon}
                </span>
                <span className="module-text">
                  <span className="module-title">{m.label}</span>
                  <span className="module-desc">{m.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
