"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import EyeIcon from "../components/EyeIcon";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirm) {
      setError("Completa todos los campos.");
      return;
    }
    if (newPassword.length < 6) {
      setError("La nueva contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("La nueva contrasena y su confirmacion no coinciden.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo cambiar la contrasena.");
      }
      // Listo: va a la app
      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "No se pudo cambiar la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <h1>Cambia tu contrasena</h1>
        <p className="subtitle">
          Por seguridad, debes establecer una nueva contrasena antes de
          continuar.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="current">Contrasena actual (temporal)</label>
            <div className="password-wrap">
              <input
                id="current"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Ocultar" : "Mostrar"}
              >
                <EyeIcon off={showCurrent} />
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="new">Nueva contrasena</label>
            <div className="password-wrap">
              <input
                id="new"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimo 6 caracteres"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Ocultar" : "Mostrar"}
              >
                <EyeIcon off={showNew} />
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirmar nueva contrasena</label>
            <input
              id="confirm"
              type={showNew ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Cambiar contrasena"}
          </button>
        </form>
      </div>
    </main>
  );
}
