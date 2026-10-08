"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import EyeIcon from "../components/EyeIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Ingresa tu email y contrasena.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo iniciar sesion.");
      }

      // Redirige a la vista principal
      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Iniciar sesion</h1>
        <p className="subtitle">Accede al gestor de reportes</p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contrasena</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                }
                title={
                  showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                }
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
