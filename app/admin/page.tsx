"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "../components/Loader";
import ConfirmDialog from "../components/ConfirmDialog";

type User = {
  id: string;
  email: string;
  name: string | null;
  position: string | null;
  role: string;
  createdAt: string;
};

// Genera una contrasena aleatoria legible
function generatePassword(length = 12) {
  const chars =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
  let out = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    out += chars[arr[i] % chars.length];
  }
  return out;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  // Guarda las credenciales recien creadas para mostrarlas una vez
  const [createdInfo, setCreatedInfo] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar los usuarios.");
      setUsers(await res.json());
    } catch (err: any) {
      setError(err.message || "Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email y contrasena son obligatorios.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, position, password, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el usuario.");
      }
      const created: User = await res.json();
      setUsers((prev) => [created, ...prev]);

      // Muestra las credenciales para copiarlas y entregarlas
      setCreatedInfo({ email: created.email, password });

      // Limpia el formulario
      setEmail("");
      setName("");
      setPosition("");
      setPassword("");
      setRole("user");
    } catch (err: any) {
      setError(err.message || "No se pudo crear el usuario.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const u = toDelete;
    if (!u) return;
    setToDelete(null);
    setError(null);
    try {
      setDeletingId(u.id);
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el usuario.");
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar el usuario.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Administracion de usuarios</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Volver a reportes
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Usuarios</h1>
        <p>Crea cuentas para que otras personas accedan al sistema.</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="card">
        <h2>Nuevo usuario</h2>

        {createdInfo && (
          <div className="generated-password">
            Usuario creado. Entrega estas credenciales (no se volveran a
            mostrar):
            <br />
            Email: <code>{createdInfo.email}</code>
            <br />
            Contrasena: <code>{createdInfo.password}</code>
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@correo.com"
              />
            </div>
            <div className="field">
              <label htmlFor="name">Nombre (opcional)</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            <div className="field">
              <label htmlFor="position">Cargo (opcional)</label>
              <input
                id="position"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ej. Analista, Gerente"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contrasena</label>
              <div className="input-with-btn">
                <input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPassword(generatePassword())}
                >
                  Generar
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="role">Rol</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-title">Usuarios registrados</h2>
        {loading ? (
          <Loader text="Cargando usuarios..." />
        ) : users.length === 0 ? (
          <div className="empty-state">No hay usuarios registrados.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Rol</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td>{u.name || "-"}</td>
                    <td>{u.position || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === "admin" ? "badge-admin" : "badge-user"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-danger"
                        onClick={() => setToDelete(u)}
                        disabled={deletingId === u.id}
                      >
                        {deletingId === u.id ? "..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar usuario"
        message={
          toDelete
            ? `Vas a eliminar al usuario ${toDelete.email}. Esta accion no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </main>
  );
}
