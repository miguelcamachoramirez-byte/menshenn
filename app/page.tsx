"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "./components/Loader";
import MultiSelect from "./components/MultiSelect";
import ConfirmDialog from "./components/ConfirmDialog";

type RecipientRef = {
  id: string;
  name: string;
  area: string | null;
};

type Report = {
  id: string;
  author: string;
  recipient: string;
  reportDate: string;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  editedBy: string | null;
  recipients: RecipientRef[];
};

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  position: string | null;
  role: string;
};

type Recipient = {
  id: string;
  name: string;
  area: string | null;
  createdAt: string;
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Para el input type=date (YYYY-MM-DD)
function toDateInput(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario (crear o editar)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    []
  );
  const [reportDate, setReportDate] = useState("");
  const [content, setContent] = useState("");

  // Destinatarios disponibles
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Busqueda y paginacion
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reporte pendiente de confirmar eliminacion
  const [toDelete, setToDelete] = useState<Report | null>(null);

  async function loadUser() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      // ignorar: el middleware ya protege la ruta
    }
  }

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

  async function loadReports() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/reports", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al cargar los reportes");
      setReports(await res.json());
    } catch (err) {
      setError("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecipients() {
    try {
      const res = await fetch("/api/recipients", { cache: "no-store" });
      if (res.ok) {
        setRecipients(await res.json());
      }
    } catch {
      // ignorar
    }
  }

  useEffect(() => {
    loadUser();
    loadReports();
    loadRecipients();
  }, []);

  function resetForm() {
    setEditingId(null);
    setSelectedRecipientIds([]);
    setReportDate("");
    setContent("");
  }

  function startEdit(report: Report) {
    setEditingId(report.id);

    let ids = report.recipients.map((r) => r.id);

    // Reportes viejos (sin relacion m2m): intenta precargar los destinatarios
    // cuyo nombre coincida con el texto antiguo guardado en "recipient".
    if (ids.length === 0 && report.recipient) {
      const names = report.recipient
        .split(",")
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean);
      ids = recipients
        .filter((r) => names.includes(r.name.toLowerCase()))
        .map((r) => r.id);
    }

    setSelectedRecipientIds(ids);
    setReportDate(toDateInput(report.reportDate));
    setContent(report.content ?? "");
    setError(null);
    // Lleva al usuario al formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedRecipientIds.length === 0 || !reportDate) {
      setError("Debes elegir al menos un destinatario y una fecha.");
      return;
    }

    const payload = {
      recipientIds: selectedRecipientIds,
      reportDate,
      content,
    };

    try {
      setSubmitting(true);
      const url = editingId ? `/api/reports/${editingId}` : "/api/reports";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el reporte.");
      }

      const saved: Report = await res.json();
      if (editingId) {
        setReports((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } else {
        setReports((prev) => [saved, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el reporte.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const report = toDelete;
    if (!report) return;
    const id = report.id;
    setToDelete(null);
    setError(null);
    try {
      setDeletingId(id);
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el reporte.");
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar el reporte.");
    } finally {
      setDeletingId(null);
    }
  }

  // --- Exportar CSV ---
  function csvCell(value: string) {
    const v = value ?? "";
    if (/[",\n;]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  function exportToCsv(rows: Report[]) {
    const header = ["Autor", "Destinatarios", "Fecha", "Detalle", "Editado"];
    const lines = rows.map((r) =>
      [
        csvCell(r.author),
        csvCell(
          r.recipients.length
            ? r.recipients.map((x) => x.name).join(", ")
            : r.recipient
        ),
        csvCell(formatDate(r.reportDate)),
        csvCell(r.content ?? ""),
        csvCell(
          r.editedAt
            ? `Editado el ${formatDate(r.editedAt)} por ${r.editedBy ?? ""}`
            : ""
        ),
      ].join(";")
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `reportes-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">
          {user ? (
            <>
              Sesion de <strong>{user.name || user.email}</strong>
              {user.position && ` · ${user.position}`}
              {user.role === "admin" && " (admin)"}
            </>
          ) : (
            "\u00a0"
          )}
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard" className="nav-link">
            Metricas
          </Link>
          <Link href="/recipients" className="nav-link">
            Destinatarios
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin" className="nav-link">
              Administrar usuarios
            </Link>
          )}
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
        <h1>Gestor de Reportes</h1>
        <p>Crea, consulta, edita y elimina reportes.</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="card">
        <h2>{editingId ? "Editar reporte" : "Nuevo reporte"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Quien hace el reporte</label>
              <input
                type="text"
                value={user ? user.name || user.email : ""}
                readOnly
                disabled
                title="Se toma de tu sesion"
              />
            </div>
            <div className="field">
              <label htmlFor="reportDate">Fecha</label>
              <input
                id="reportDate"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="field full">
              <div className="recipients-label">
                <label htmlFor="recipientsSelect">
                  A quien va dirigido (uno o varios)
                </label>
                <Link href="/recipients" className="field-hint-link">
                  + Administrar destinatarios
                </Link>
              </div>
              {recipients.length === 0 ? (
                <div className="empty-state" style={{ padding: "1rem" }}>
                  No hay destinatarios. Agrega al menos uno en{" "}
                  <Link href="/recipients" className="field-hint-link">
                    Destinatarios
                  </Link>
                  .
                </div>
              ) : (
                <MultiSelect
                  options={recipients.map((r) => ({
                    value: r.id,
                    label: r.name,
                    sub: r.area,
                  }))}
                  selected={selectedRecipientIds}
                  onChange={setSelectedRecipientIds}
                  placeholder="Selecciona uno o varios destinatarios..."
                />
              )}
            </div>
            <div className="field full">
              <label htmlFor="content">Detalle (opcional)</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Descripcion del reporte..."
              />
            </div>
          </div>
          <div className="form-actions">
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetForm}
                style={{ marginRight: "0.6rem" }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? "Guardando..."
                : editingId
                ? "Guardar cambios"
                : "Agregar reporte"}
            </button>
          </div>
        </form>
      </section>

      <section>
        {(() => {
          const term = search.trim().toLowerCase();
          const filtered = term
            ? reports.filter(
                (r) =>
                  r.author.toLowerCase().includes(term) ||
                  r.recipient.toLowerCase().includes(term) ||
                  r.recipients.some((x) =>
                    x.name.toLowerCase().includes(term)
                  )
              )
            : reports;

          const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
          const currentPage = Math.min(page, totalPages);
          const start = (currentPage - 1) * pageSize;
          const pageRows = filtered.slice(start, start + pageSize);

          return (
            <>
              <div className="reports-head">
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Reportes
                  {!loading && (
                    <span className="count-badge">{reports.length}</span>
                  )}
                </h2>
                <div className="reports-tools">
                  {reports.length > 0 && (
                    <input
                      type="search"
                      className="search-input"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Buscar por autor o destinatario..."
                    />
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => exportToCsv(filtered)}
                    disabled={filtered.length === 0}
                    title="Exportar a CSV (Excel)"
                  >
                    Exportar Excel
                  </button>
                </div>
              </div>

              {loading ? (
                <Loader text="Cargando reportes..." />
              ) : reports.length === 0 ? (
                <div className="empty-state">
                  No existen reportes todavia. Crea el primero con el formulario
                  de arriba.
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  No hay reportes que coincidan con "{search}".
                </div>
              ) : (
                <>
                  <div
                    className="card"
                    style={{ padding: 0, overflow: "hidden" }}
                  >
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Autor</th>
                          <th>Destinatarios</th>
                          <th>Fecha</th>
                          <th>Detalle</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((report) => {
                          const isOpen = expandedId === report.id;
                          const hasDetail = Boolean(report.content);
                          const recipientNames = report.recipients.length
                            ? report.recipients.map((x) => x.name).join(", ")
                            : report.recipient;
                          return (
                            <Fragment key={report.id}>
                              <tr
                                className={
                                  hasDetail ? "row-clickable" : undefined
                                }
                                onClick={
                                  hasDetail
                                    ? () =>
                                        setExpandedId(isOpen ? null : report.id)
                                    : undefined
                                }
                              >
                                <td>
                                  <div className="cell-author">
                                    <span
                                      className="mini-avatar"
                                      aria-hidden="true"
                                    >
                                      {report.author.charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                      {report.author}
                                      {report.editedAt && (
                                        <span className="edited-tag">
                                          editado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {report.recipients.length > 0 ? (
                                    <div className="recipient-tags">
                                      {report.recipients.map((x) => (
                                        <span key={x.id} className="tag">
                                          {x.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    recipientNames
                                  )}
                                </td>
                                <td className="nowrap">
                                  {formatDate(report.reportDate)}
                                </td>
                                <td className="cell-detail">
                                  {report.content || "-"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div className="row-actions">
                                    <button
                                      className="btn btn-ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEdit(report);
                                      }}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      className="btn btn-danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setToDelete(report);
                                      }}
                                      disabled={deletingId === report.id}
                                    >
                                      {deletingId === report.id
                                        ? "..."
                                        : "Eliminar"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {isOpen && hasDetail && (
                                <tr className="detail-row">
                                  <td colSpan={5}>
                                    <div className="detail-box">
                                      <span className="label">Detalle</span>
                                      <p>{report.content}</p>
                                      {report.editedAt && (
                                        <p className="edited-note">
                                          Editado el{" "}
                                          {formatDate(report.editedAt)}
                                          {report.editedBy
                                            ? ` por ${report.editedBy}`
                                            : ""}
                                          .
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination">
                    <div className="page-size">
                      <label htmlFor="pageSize">Filas por pagina:</label>
                      <select
                        id="pageSize"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    <div className="page-nav">
                      <button
                        className="btn btn-ghost"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </button>
                      <span className="page-info">
                        {start + 1}-{Math.min(start + pageSize, filtered.length)}{" "}
                        de {filtered.length}
                      </span>
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          );
        })()}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar reporte"
        message={
          toDelete
            ? `Vas a eliminar el reporte de ${toDelete.author} dirigido a ${
                toDelete.recipients.length
                  ? toDelete.recipients.map((r) => r.name).join(", ")
                  : toDelete.recipient
              }. Esta accion no se puede deshacer.`
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
