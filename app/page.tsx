"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Loader from "./components/Loader";
import MultiSelect from "./components/MultiSelect";
import ConfirmDialog from "./components/ConfirmDialog";
import ImageUpload from "./components/ImageUpload";

type RecipientRef = {
  id: string;
  name: string;
  area: string | null;
};

type ReportEdit = {
  id: string;
  editedBy: string;
  editedAt: string;
  recipient: string;
  reportDate: string;
  content: string | null;
  imageUrl: string | null;
};

type Report = {
  id: string;
  author: string;
  authorId: string | null;
  recipient: string;
  reportDate: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  editedBy: string | null;
  recipients: RecipientRef[];
  edits: ReportEdit[];
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

// Fecha + hora, para la traza de ediciones
function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calcula los numeros de pagina a mostrar, con "..." cuando hay muchas.
// Ej: [1, "...", 4, 5, 6, "...", 20]
function getPageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) items.push("...");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push("...");

  items.push(total);
  return items;
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
  const [editingOriginal, setEditingOriginal] = useState<Report | null>(null);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    []
  );
  const [reportDate, setReportDate] = useState("");
  const [content, setContent] = useState("");
  // Imagen: archivo nuevo seleccionado (sin subir) + url existente al editar
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

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
    setEditingOriginal(null);
    setSelectedRecipientIds([]);
    setReportDate("");
    setContent("");
    setImageFile(null);
    setExistingImageUrl(null);
  }

  function startEdit(report: Report) {
    setEditingId(report.id);
    setEditingOriginal(report);

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
    setImageFile(null);
    setExistingImageUrl(report.imageUrl ?? null);
    setError(null);
    // Lleva al usuario al formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // En modo edicion, indica si hubo algun cambio respecto al original
  function hasChanges(): boolean {
    if (!editingOriginal) return true; // en modo crear, siempre "hay cambios"

    const origIds = [...editingOriginal.recipients.map((r) => r.id)].sort();
    const curIds = [...selectedRecipientIds].sort();
    const recipientsChanged =
      origIds.length !== curIds.length ||
      origIds.some((id, i) => id !== curIds[i]);

    const dateChanged = toDateInput(editingOriginal.reportDate) !== reportDate;
    const contentChanged = (editingOriginal.content ?? "") !== content;
    // Cambio de imagen: hay archivo nuevo, o se quito la imagen existente
    const imageChanged =
      imageFile !== null ||
      (editingOriginal.imageUrl ?? null) !== existingImageUrl;

    return recipientsChanged || dateChanged || contentChanged || imageChanged;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      selectedRecipientIds.length === 0 ||
      !reportDate ||
      content.trim() === ""
    ) {
      setError("Todos los campos son obligatorios: tipo de reporte, fecha y detalle.");
      return;
    }

    try {
      setSubmitting(true);

      // Si hay una imagen nueva seleccionada, se sube AHORA (al enviar el form).
      // Si no, se conserva la imagen existente (al editar) o queda sin imagen.
      let finalImageUrl: string | null = existingImageUrl;
      if (imageFile) {
        const form = new FormData();
        form.append("file", imageFile);
        const up = await fetch("/api/upload", { method: "POST", body: form });
        if (!up.ok) {
          const data = await up.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo subir la imagen.");
        }
        const upData = await up.json();
        finalImageUrl = upData.url;
      }

      const payload = {
        recipientIds: selectedRecipientIds,
        reportDate,
        content,
        imageUrl: finalImageUrl,
      };

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
    const header = [
      "Autor",
      "Tipo de reporte",
      "Fecha",
      "Detalle",
      "Imagen",
      "Ultima edicion",
    ];
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
        csvCell(r.imageUrl ?? ""),
        csvCell(r.editedAt ? formatDateTime(r.editedAt) : ""),
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
          {user?.role === "admin" && (
            <>
              <Link href="/dashboard" className="nav-link">
                Metricas
              </Link>
              <Link href="/recipients" className="nav-link">
                Tipos de reporte
              </Link>
              <Link href="/capacitaciones" className="nav-link">
                Capacitaciones
              </Link>
              <Link href="/admin" className="nav-link">
                Administrar usuarios
              </Link>
            </>
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
        <h1>Reporte de actos y condiciones inseguras</h1>
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
                  Tipo de reporte (uno o varios)
                </label>
                {user?.role === "admin" && (
                  <Link href="/recipients" className="field-hint-link">
                    + Administrar tipos de reporte
                  </Link>
                )}
              </div>
              {recipients.length === 0 ? (
                <div className="empty-state" style={{ padding: "1rem" }}>
                  {user?.role === "admin" ? (
                    <>
                      No hay tipos de reporte. Agrega al menos uno en{" "}
                      <Link href="/recipients" className="field-hint-link">
                        Tipos de reporte
                      </Link>
                      .
                    </>
                  ) : (
                    "No hay tipos de reporte. Pide a un administrador que agregue tipos de reporte."
                  )}
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
                  placeholder="Selecciona uno o varios tipos de reporte..."
                />
              )}
            </div>
            <div className="field full">
              <label htmlFor="content">Detalle</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Descripcion del reporte..."
              />
            </div>
            <div className="field full">
              <label>Imagen (opcional)</label>
              <ImageUpload
                existingUrl={existingImageUrl}
                file={imageFile}
                onSelect={(f) => {
                  setImageFile(f);
                  // Si quita la imagen, tambien limpia la existente
                  if (f === null) setExistingImageUrl(null);
                }}
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
              disabled={
                submitting ||
                selectedRecipientIds.length === 0 ||
                !reportDate ||
                content.trim() === "" ||
                !hasChanges()
              }
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
            ? reports.filter((r) => {
                // Busca en todo el contenido visible de la fila
                const haystack = [
                  r.author,
                  r.recipient,
                  r.recipients.map((x) => x.name).join(" "),
                  r.content ?? "",
                  formatDate(r.reportDate),
                ]
                  .join(" ")
                  .toLowerCase();
                return haystack.includes(term);
              })
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
                      placeholder="Buscar en los reportes..."
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
                  <div className="card table-wrap" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Autor</th>
                          <th>Tipo de reporte</th>
                          <th>Fecha</th>
                          <th>Detalle</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((report) => {
                          const isOpen = expandedId === report.id;
                          const hasDetail = Boolean(report.content);
                          const hasHistory = report.edits.length > 0;
                          const hasImage = Boolean(report.imageUrl);
                          const expandable = hasDetail || hasHistory || hasImage;
                          const isAdmin = user?.role === "admin";
                          // Solo el autor puede editar (ni siquiera el admin)
                          const canEdit =
                            user != null && report.authorId === user.id;
                          const recipientNames = report.recipients.length
                            ? report.recipients.map((x) => x.name).join(", ")
                            : report.recipient;
                          return (
                            <Fragment key={report.id}>
                              <tr
                                className={`${
                                  expandable ? "row-clickable" : ""
                                } ${isOpen ? "row-open" : ""}`.trim()}
                                onClick={
                                  expandable
                                    ? () =>
                                        setExpandedId(isOpen ? null : report.id)
                                    : undefined
                                }
                              >
                                <td data-label="Autor">
                                  <div className="cell-author">
                                    <span
                                      className="mini-avatar"
                                      aria-hidden="true"
                                    >
                                      {report.author.charAt(0).toUpperCase()}
                                    </span>
                                    <div>
                                      <div className="author-name">
                                        {report.author}
                                        {report.editedAt && (
                                          <span className="edited-tag">
                                            editado
                                          </span>
                                        )}
                                      </div>
                                      <div className="author-date">
                                        {formatDateTime(report.createdAt)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td data-label="Tipo de reporte">
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
                                <td data-label="Fecha" className="nowrap">
                                  {formatDate(report.reportDate)}
                                </td>
                                <td data-label="Detalle" className="cell-detail">
                                  {report.content || "-"}
                                </td>
                                <td
                                  className="cell-actions"
                                  style={{ textAlign: "right" }}
                                >
                                  <div className="row-actions">
                                    {canEdit && (
                                      <button
                                        className="btn btn-ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEdit(report);
                                        }}
                                      >
                                        Editar
                                      </button>
                                    )}
                                    {isAdmin && (
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
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOpen && expandable && (
                                <tr className="detail-row">
                                  <td colSpan={5}>
                                    <div className="detail-box">
                                      {hasDetail && (
                                        <>
                                          <span className="label">Detalle</span>
                                          <p>{report.content}</p>
                                        </>
                                      )}

                                      {report.imageUrl && (
                                        <div className="report-image">
                                          <span className="label">Imagen</span>
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <a
                                            href={report.imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <img
                                              src={report.imageUrl}
                                              alt="Imagen del reporte"
                                            />
                                          </a>
                                        </div>
                                      )}

                                      {hasHistory && (
                                        <div className="trace">
                                          <span className="label">
                                            Traza de ediciones (que cambio en
                                            cada edicion)
                                          </span>
                                          <ul className="trace-list">
                                            {report.edits.map((ed, i) => {
                                              // "after" = estado que reemplazo a esta version.
                                              // La version mas nueva (i===0) fue reemplazada
                                              // por el estado ACTUAL del reporte.
                                              const after =
                                                i === 0
                                                  ? {
                                                      recipient:
                                                        report.recipient,
                                                      reportDate:
                                                        report.reportDate,
                                                      content: report.content,
                                                      imageUrl:
                                                        report.imageUrl,
                                                    }
                                                  : report.edits[i - 1];

                                              const tipoChanged =
                                                ed.recipient !==
                                                after.recipient;
                                              const fechaChanged =
                                                toDateInput(ed.reportDate) !==
                                                toDateInput(after.reportDate);
                                              const detalleChanged =
                                                (ed.content ?? "") !==
                                                (after.content ?? "");
                                              const imagenChanged =
                                                (ed.imageUrl ?? null) !==
                                                (after.imageUrl ?? null);

                                              return (
                                                <li
                                                  key={ed.id}
                                                  className="trace-item"
                                                >
                                                  <div className="trace-head">
                                                    <strong>
                                                      {formatDateTime(
                                                        ed.editedAt
                                                      )}
                                                    </strong>
                                                  </div>
                                                  <div className="trace-body">
                                                    {tipoChanged && (
                                                      <div>
                                                        <span className="trace-field">
                                                          Tipo anterior:
                                                        </span>{" "}
                                                        {ed.recipient}
                                                      </div>
                                                    )}
                                                    {fechaChanged && (
                                                      <div>
                                                        <span className="trace-field">
                                                          Fecha anterior:
                                                        </span>{" "}
                                                        {formatDate(
                                                          ed.reportDate
                                                        )}
                                                      </div>
                                                    )}
                                                    {detalleChanged && (
                                                      <div>
                                                        <span className="trace-field">
                                                          Detalle anterior:
                                                        </span>{" "}
                                                        {ed.content || "(vacio)"}
                                                      </div>
                                                    )}
                                                    {imagenChanged && (
                                                      <div>
                                                        <span className="trace-field">
                                                          Imagen anterior:
                                                        </span>
                                                        {ed.imageUrl ? (
                                                          <div className="trace-image">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <a
                                                              href={ed.imageUrl}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                            >
                                                              <img
                                                                src={
                                                                  ed.imageUrl
                                                                }
                                                                alt="Imagen anterior"
                                                              />
                                                            </a>
                                                          </div>
                                                        ) : (
                                                          " (sin imagen)"
                                                        )}
                                                      </div>
                                                    )}
                                                    {!tipoChanged &&
                                                      !fechaChanged &&
                                                      !detalleChanged &&
                                                      !imagenChanged && (
                                                        <span className="trace-nochange">
                                                          Sin cambios visibles
                                                        </span>
                                                      )}
                                                  </div>
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        </div>
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
                        className="btn btn-ghost page-btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label="Pagina anterior"
                      >
                        ‹
                      </button>

                      {getPageItems(currentPage, totalPages).map((it, i) =>
                        it === "..." ? (
                          <span key={`dots-${i}`} className="page-dots">
                            ...
                          </span>
                        ) : (
                          <button
                            key={it}
                            className={`btn page-btn ${
                              it === currentPage
                                ? "btn-primary"
                                : "btn-ghost"
                            }`}
                            onClick={() => setPage(it)}
                          >
                            {it}
                          </button>
                        )
                      )}

                      <button
                        className="btn btn-ghost page-btn"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        aria-label="Pagina siguiente"
                      >
                        ›
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
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </main>
  );
}
