"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Loader from "../components/Loader";
import ConfirmDialog from "../components/ConfirmDialog";

type RiskType = {
  id: string;
  name: string;
  createdAt: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function RiskTypesPage() {
  const [items, setItems] = useState<RiskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<RiskType | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/recipients", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar los tipos de reporte.");
      setItems(await res.json());
    } catch (err: any) {
      setError(err.message || "Error al cargar los tipos de reporte.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("El nombre del tipo de reporte es obligatorio.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el tipo de reporte.");
      }
      const created: RiskType = await res.json();
      setItems((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setName("");
    } catch (err: any) {
      setError(err.message || "No se pudo crear el tipo de reporte.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const r = toDelete;
    if (!r) return;
    setToDelete(null);
    setError(null);
    try {
      setDeletingId(r.id);
      const res = await fetch(`/api/recipients/${r.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el tipo de reporte.");
      }
      setItems((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar el tipo de reporte.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Tipos de reporte</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Volver a reportes
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Tipos de reporte</h1>
        <p>Categorias que se asignan a los reportes.</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="card">
        <h2>Nuevo tipo de reporte</h2>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="name">Nombre</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Fisico, Biologico, Mecanico, Quimico"
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || name.trim() === ""}
            >
              {submitting ? "Guardando..." : "Agregar tipo de reporte"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-title">Lista de tipos de reporte</h2>
        {loading ? (
          <Loader text="Cargando tipos de reporte..." />
        ) : items.length === 0 ? (
          <div className="empty-state">
            Aun no hay tipos de reporte. Agrega el primero con el formulario de
            arriba.
          </div>
        ) : (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Nombre">{r.name}</td>
                    <td data-label="Creado">{formatDate(r.createdAt)}</td>
                    <td className="cell-actions" style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-danger"
                        onClick={() => setToDelete(r)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? "..." : "Eliminar"}
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
        title="Eliminar tipo de reporte"
        message={
          toDelete
            ? `Vas a eliminar el tipo de reporte "${toDelete.name}". Esta accion no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        danger
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </main>
  );
}
