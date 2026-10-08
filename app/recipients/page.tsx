"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Loader from "../components/Loader";
import ConfirmDialog from "../components/ConfirmDialog";

type Recipient = {
  id: string;
  idNumber: string;
  name: string;
  area: string | null;
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

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idNumber, setIdNumber] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Recipient | null>(null);

  async function loadRecipients() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/recipients", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar los destinatarios.");
      setRecipients(await res.json());
    } catch (err: any) {
      setError(err.message || "Error al cargar destinatarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipients();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idNumber.trim() || !name.trim()) {
      setError("La cedula y el nombre son obligatorios.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idNumber, name, area }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el destinatario.");
      }
      const created: Recipient = await res.json();
      setRecipients((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setIdNumber("");
      setName("");
      setArea("");
    } catch (err: any) {
      setError(err.message || "No se pudo crear el destinatario.");
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
        throw new Error(data.error || "No se pudo eliminar el destinatario.");
      }
      setRecipients((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar el destinatario.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Destinatarios</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Volver a reportes
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Destinatarios</h1>
        <p>Personas a las que se pueden dirigir los reportes.</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="card">
        <h2>Nuevo destinatario</h2>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="idNumber">Numero de cedula</label>
              <input
                id="idNumber"
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Ej. 1012345678"
              />
            </div>
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Juan Perez"
              />
            </div>
            <div className="field">
              <label htmlFor="area">Area / cargo (opcional)</label>
              <input
                id="area"
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej. Gerencia"
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Agregar destinatario"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-title">Lista de destinatarios</h2>
        {loading ? (
          <Loader text="Cargando destinatarios..." />
        ) : recipients.length === 0 ? (
          <div className="empty-state">
            Aun no hay destinatarios. Agrega el primero con el formulario de
            arriba.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Cedula</th>
                  <th>Nombre</th>
                  <th>Area / cargo</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td>{r.idNumber}</td>
                    <td>{r.name}</td>
                    <td>{r.area || "-"}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
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
        title="Eliminar destinatario"
        message={
          toDelete
            ? `Vas a eliminar al destinatario ${toDelete.name}. Esta accion no se puede deshacer.`
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
