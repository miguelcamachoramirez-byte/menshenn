"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Loader from "../components/Loader";
import ConfirmDialog from "../components/ConfirmDialog";
import ShareIcon from "../components/ShareIcon";

type Training = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  embedUrl: string | null;
  fileUrl: string | null;
  active: boolean;
  requireAttendance: boolean;
  createdAt: string;
  _count: { attendances: number };
};

type Cohort = {
  id: string;
  name: string;
  active: boolean;
  hasAccessKey: boolean;
  accessKey: string | null;
  attendances: number;
  createdAt: string;
};

type Attendance = {
  id: string;
  fullName: string;
  idNumber: string;
  company: string | null;
  position: string | null;
  createdAt: string;
};

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

// Genera una clave corta y legible (sin caracteres confusos)
function generateKey(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

export default function CapacitacionesPage() {
  const [items, setItems] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Formulario de capacitacion (crear/editar) ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mediaMode, setMediaMode] = useState<"pdf" | "link">("link");
  const [minMinutes, setMinMinutes] = useState(0);
  const [requireAttendance, setRequireAttendance] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  type QDraft = { question: string; options: string[]; correct: number };
  const [questions, setQuestions] = useState<QDraft[]>([]);

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", ""], correct: 0 },
    ]);
  }
  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateQuestion(i: number, patch: Partial<QDraft>) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q))
    );
  }
  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi ? { ...q, options: [...q.options, ""] } : q
      )
    );
  }
  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) }
          : q
      )
    );
  }
  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qi) return q;
        const options = q.options.filter((_, j) => j !== oi);
        const correct = q.correct >= options.length ? 0 : q.correct;
        return { ...q, options, correct };
      })
    );
  }

  const [toDelete, setToDelete] = useState<Training | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Convocatorias ---
  const [cohortsOf, setCohortsOf] = useState<Training | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortKey, setNewCohortKey] = useState("");
  const [creatingCohort, setCreatingCohort] = useState(false);
  const [cohortBusyId, setCohortBusyId] = useState<string | null>(null);
  const [copiedCohortId, setCopiedCohortId] = useState<string | null>(null);
  const [sharedCohortId, setSharedCohortId] = useState<string | null>(null);
  const [cohortToDelete, setCohortToDelete] = useState<Cohort | null>(null);

  // --- Asistencias de una convocatoria ---
  const [viewingCohort, setViewingCohort] = useState<Cohort | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/trainings", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar las capacitaciones.");
      setItems(await res.json());
    } catch (err: any) {
      setError(err.message || "Error al cargar capacitaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setContent("");
    setEmbedUrl("");
    setFileUrl("");
    setMediaMode("link");
    setMinMinutes(0);
    setRequireAttendance(true);
    setQuestions([]);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("El archivo debe ser un PDF.");
      return;
    }
    setError(null);
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo subir el PDF.");
      setFileUrl(data.url);
    } catch (err: any) {
      setError(err.message || "No se pudo subir el PDF.");
    } finally {
      setUploading(false);
    }
  }

  async function startEdit(t: Training) {
    setError(null);
    try {
      setLoadingEdit(t.id);
      const res = await fetch(`/api/trainings/${t.id}/edit`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo cargar para editar.");
      }
      const d = await res.json();
      setEditingId(d.id);
      setTitle(d.title ?? "");
      setDescription(d.description ?? "");
      setContent(d.content ?? "");
      setEmbedUrl(d.embedUrl ?? "");
      setFileUrl(d.fileUrl ?? "");
      setMediaMode(d.fileUrl && !d.embedUrl ? "pdf" : "link");
      setMinMinutes(d.minMinutes ?? 0);
      setRequireAttendance(d.requireAttendance !== false);
      setQuestions(
        (d.questions ?? []).map((q: any) => ({
          question: q.question ?? "",
          options:
            Array.isArray(q.options) && q.options.length >= 2
              ? q.options
              : ["", ""],
          correct: q.correct ?? 0,
        }))
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "No se pudo cargar para editar.");
    } finally {
      setLoadingEdit(null);
    }
  }

  async function handleSubmitForm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("El titulo es obligatorio.");
      return;
    }
    const media = mediaMode === "pdf" ? fileUrl.trim() : embedUrl.trim();
    if (!content.trim() && !media) {
      setError("Agrega contenido (texto), un PDF o un enlace.");
      return;
    }
    try {
      setSubmitting(true);
      const validQuestions = questions
        .map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()).filter(Boolean),
          correct: q.correct,
        }))
        .filter((q) => q.question && q.options.length >= 2);

      const payload = {
        title,
        description,
        content,
        embedUrl: mediaMode === "link" ? embedUrl : "",
        fileUrl: mediaMode === "pdf" ? fileUrl : "",
        minMinutes,
        requireAttendance,
        questions: requireAttendance ? validQuestions : [],
      };

      const res = await fetch(
        editingId ? `/api/trainings/${editingId}` : "/api/trainings",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la capacitacion.");
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la capacitacion.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    const t = toDelete;
    if (!t) return;
    setToDelete(null);
    try {
      setDeletingId(t.id);
      const res = await fetch(`/api/trainings/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar.");
      }
      setItems((prev) => prev.filter((x) => x.id !== t.id));
      if (cohortsOf?.id === t.id) setCohortsOf(null);
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  // ----------------- Convocatorias -----------------

  async function openCohorts(t: Training) {
    setCohortsOf(t);
    setCohorts([]);
    setNewCohortName("");
    setNewCohortKey("");
    setError(null);
    try {
      setLoadingCohorts(true);
      const res = await fetch(`/api/trainings/${t.id}/cohorts`, {
        cache: "no-store",
      });
      if (res.ok) setCohorts(await res.json());
    } finally {
      setLoadingCohorts(false);
    }
  }

  async function createCohort() {
    const t = cohortsOf;
    if (!t) return;
    if (!newCohortName.trim()) {
      setError("Escribe el nombre de la convocatoria.");
      return;
    }
    setError(null);
    try {
      setCreatingCohort(true);
      const res = await fetch(`/api/trainings/${t.id}/cohorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCohortName.trim(),
          accessKey: newCohortKey.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo crear.");
      setCohorts((prev) => [data, ...prev]);
      setNewCohortName("");
      setNewCohortKey("");
      // Actualiza el contador total en la lista
      load();
    } catch (err: any) {
      setError(err.message || "No se pudo crear la convocatoria.");
    } finally {
      setCreatingCohort(false);
    }
  }

  async function toggleCohort(c: Cohort) {
    const t = cohortsOf;
    if (!t) return;
    setError(null);
    try {
      setCohortBusyId(c.id);
      const res = await fetch(`/api/trainings/${t.id}/cohorts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar.");
      setCohorts((prev) => prev.map((x) => (x.id === c.id ? data : x)));
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la convocatoria.");
    } finally {
      setCohortBusyId(null);
    }
  }

  async function confirmDeleteCohort() {
    const t = cohortsOf;
    const c = cohortToDelete;
    if (!t || !c) return;
    setCohortToDelete(null);
    setError(null);
    try {
      setCohortBusyId(c.id);
      const res = await fetch(`/api/trainings/${t.id}/cohorts/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar.");
      }
      setCohorts((prev) => prev.filter((x) => x.id !== c.id));
      load();
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar la convocatoria.");
    } finally {
      setCohortBusyId(null);
    }
  }

  // Copia un mensaje listo para pegar (WhatsApp, correo) con enlace + clave.
  function shareCohort(t: Training, c: Cohort) {
    const url = `${window.location.origin}/capacitacion/${t.id}?c=${c.id}`;
    const lines = [
      `Capacitacion: ${t.title}`,
      `Convocatoria: ${c.name}`,
      `Enlace: ${url}`,
    ];
    if (c.accessKey) lines.push(`Clave de acceso: ${c.accessKey}`);
    navigator.clipboard.writeText(lines.join("\n"));
    setSharedCohortId(c.id);
    setTimeout(() => setSharedCohortId(null), 2000);
  }

  async function viewCohortAttendances(t: Training, c: Cohort) {
    setViewingCohort(c);
    setAttendances([]);
    try {
      setLoadingAtt(true);
      const res = await fetch(
        `/api/trainings/${t.id}/cohorts/${c.id}/attendance`,
        { cache: "no-store" }
      );
      if (res.ok) setAttendances(await res.json());
    } finally {
      setLoadingAtt(false);
    }
  }

  function copyInfoLink(t: Training) {
    const url = `${window.location.origin}/capacitacion/${t.id}`;
    navigator.clipboard.writeText(url);
    setCopiedCohortId(t.id);
    setTimeout(() => setCopiedCohortId(null), 2000);
  }

  function csvCell(v: string) {
    const s = v ?? "";
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportAttendances(c: Cohort, rows: Attendance[]) {
    const header = ["Nombre", "Cedula", "Empresa", "Cargo", "Fecha y hora"];
    const lines = rows.map((r) =>
      [
        csvCell(r.fullName),
        csvCell(r.idNumber),
        csvCell(r.company ?? ""),
        csvCell(r.position ?? ""),
        csvCell(formatDateTime(r.createdAt)),
      ].join(";")
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia-${c.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Capacitaciones</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Inicio
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Capacitaciones</h1>
        <p>
          Crea una capacitacion una sola vez y reutilizala en varias
          convocatorias. Cada convocatoria tiene su propia clave, su estado y su
          registro de asistencia.
        </p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <section className="card">
        <h2>{editingId ? "Editar capacitacion" : "Nueva capacitacion"}</h2>
        <form onSubmit={handleSubmitForm}>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="title">Titulo</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Trabajo seguro en alturas"
              />
            </div>
            <div className="field full">
              <label htmlFor="description">Descripcion (opcional)</label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripcion"
              />
            </div>
            <div className="field full">
              <label htmlFor="content">Contenido (texto)</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe aqui el contenido de la capacitacion..."
                style={{ minHeight: "120px" }}
              />
            </div>
            <div className="field full">
              <label>Material de la capacitacion (opcional)</label>
              <span className="field-help" style={{ marginBottom: "0.5rem" }}>
                Elige como mostrar el material: incrusta un enlace o sube un PDF
                (lo mas confiable para PowerPoint). Tambien puedes dejarlo solo
                con el contenido de texto de arriba.
              </span>

              <div className="media-choice">
                <button
                  type="button"
                  className={`media-option ${
                    mediaMode === "link" ? "active" : ""
                  }`}
                  onClick={() => setMediaMode("link")}
                  aria-pressed={mediaMode === "link"}
                >
                  <span className="media-option-icon">🔗</span>
                  <span className="media-option-text">
                    <span className="media-option-title">Incrustar enlace</span>
                    <span className="media-option-desc">
                      YouTube, Slides, Canva, web
                    </span>
                  </span>
                  <span className="media-option-check" aria-hidden="true">
                    {mediaMode === "link" ? "●" : "○"}
                  </span>
                </button>
                <button
                  type="button"
                  className={`media-option ${
                    mediaMode === "pdf" ? "active" : ""
                  }`}
                  onClick={() => setMediaMode("pdf")}
                  aria-pressed={mediaMode === "pdf"}
                >
                  <span className="media-option-icon">📄</span>
                  <span className="media-option-text">
                    <span className="media-option-title">Subir un PDF</span>
                    <span className="media-option-desc">
                      Recomendado para PowerPoint
                    </span>
                  </span>
                  <span className="media-option-check" aria-hidden="true">
                    {mediaMode === "pdf" ? "●" : "○"}
                  </span>
                </button>
              </div>

              {mediaMode === "link" ? (
                <>
                  <textarea
                    id="embedUrl"
                    value={embedUrl}
                    onChange={(e) => setEmbedUrl(e.target.value)}
                    placeholder="Pega aqui el enlace o el codigo <iframe> de insertar"
                    style={{ minHeight: "70px", marginTop: "0.6rem" }}
                  />
                  <span className="field-help">
                    Sirve YouTube, Google Slides, Canva, Vimeo o un enlace web.
                  </span>
                </>
              ) : (
                <div style={{ marginTop: "0.6rem" }}>
                  <span
                    className="field-help"
                    style={{ marginBottom: "0.5rem", display: "block" }}
                  >
                    En tu PPT usa{" "}
                    <strong>Archivo → Guardar como / Exportar → PDF</strong> y
                    sube el PDF aqui. Se vera incrustado dentro de la
                    plataforma.
                  </span>
                  {fileUrl ? (
                    <div className="input-with-btn">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost"
                        style={{ flex: 1, textAlign: "left" }}
                      >
                        📄 PDF cargado (ver)
                      </a>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setFileUrl("")}
                      >
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <label
                      className="btn btn-ghost"
                      style={{ cursor: "pointer" }}
                    >
                      {uploading ? "Subiendo..." : "Subir PDF"}
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        style={{ display: "none" }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="field full">
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={requireAttendance}
                  onChange={(e) => setRequireAttendance(e.target.checked)}
                />
                <span>
                  Requiere registro de asistencia
                  <span className="field-help" style={{ display: "block" }}>
                    Si lo desactivas, la capacitacion sera solo informativa
                    (publica, sin pedir datos ni cuestionario ni convocatorias).
                  </span>
                </span>
              </label>
            </div>

            {requireAttendance && (
              <div className="field">
                <label htmlFor="minMinutes">
                  Tiempo minimo antes de confirmar (minutos)
                </label>
                <input
                  id="minMinutes"
                  type="number"
                  min={0}
                  value={minMinutes}
                  onChange={(e) => setMinMinutes(Number(e.target.value) || 0)}
                  placeholder="0 = sin temporizador"
                />
                <span className="field-help">
                  0 significa que puede continuar de inmediato.
                </span>
              </div>
            )}
          </div>

          {requireAttendance && (
            <div className="quiz-builder">
              <div className="quiz-builder-head">
                <span className="label">Cuestionario (opcional)</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={addQuestion}
                >
                  + Agregar pregunta
                </button>
              </div>
              <p className="field-help">
                Si agregas preguntas, el asistente debe responder TODAS
                correctamente para registrar su asistencia.
              </p>

              {questions.map((q, qi) => (
                <div key={qi} className="quiz-builder-q">
                  <div className="quiz-builder-q-head">
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) =>
                        updateQuestion(qi, { question: e.target.value })
                      }
                      placeholder={`Pregunta ${qi + 1}`}
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => removeQuestion(qi)}
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="quiz-builder-opts">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="quiz-builder-opt">
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={q.correct === oi}
                          onChange={() => updateQuestion(qi, { correct: oi })}
                          title="Marcar como respuesta correcta"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(qi, oi, e.target.value)}
                          placeholder={`Opcion ${oi + 1}`}
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => removeOption(qi, oi)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => addOption(qi)}
                    >
                      + Opcion
                    </button>
                  </div>
                  <span className="field-help">
                    Marca el circulo de la opcion correcta.
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions" style={{ gap: "0.6rem" }}>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetForm}
                disabled={submitting}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || uploading}
            >
              {submitting
                ? "Guardando..."
                : editingId
                ? "Guardar cambios"
                : "Crear capacitacion"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="section-title">Capacitaciones creadas</h2>
        {loading ? (
          <Loader text="Cargando..." />
        ) : items.length === 0 ? (
          <div className="empty-state">Aun no hay capacitaciones.</div>
        ) : (
          <ul style={{ listStyle: "none" }}>
            {items.map((t) => (
              <li key={t.id} className="training-item card">
                <div className="training-info">
                  <div className="training-title">{t.title}</div>
                  {t.description && (
                    <div className="training-desc">{t.description}</div>
                  )}
                  <div className="training-meta">
                    {t.requireAttendance ? (
                      <span className="badge badge-user">
                        {t._count.attendances} asistente(s) en total
                      </span>
                    ) : (
                      <span className="badge badge-user">Informativa</span>
                    )}
                  </div>
                  <div className="training-actions">
                    {!t.requireAttendance && (
                      <>
                        <a
                          href={`/capacitacion/${t.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost"
                        >
                          Ver
                        </a>
                        <button
                          className="btn btn-ghost"
                          onClick={() => copyInfoLink(t)}
                        >
                          {copiedCohortId === t.id
                            ? "Copiado!"
                            : "Copiar enlace"}
                        </button>
                      </>
                    )}
                    {t.requireAttendance && (
                      <button
                        className="btn btn-primary"
                        onClick={() => openCohorts(t)}
                      >
                        Convocatorias
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => startEdit(t)}
                      disabled={loadingEdit === t.id}
                    >
                      {loadingEdit === t.id ? "..." : "Editar"}
                    </button>

                    <span className="training-actions-right">
                      <button
                        className="btn btn-danger"
                        onClick={() => setToDelete(t)}
                        disabled={deletingId === t.id}
                      >
                        {deletingId === t.id ? "..." : "Eliminar"}
                      </button>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal: convocatorias de una capacitacion */}
      {cohortsOf && (
        <div className="modal-overlay" onClick={() => setCohortsOf(null)}>
          <div
            className="modal modal-lg"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title" style={{ marginBottom: "0.2rem" }}>
                  Convocatorias
                </h3>
                <span className="modal-sub">{cohortsOf.title}</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setCohortsOf(null)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Crear nueva convocatoria */}
              <div className="cohort-create">
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <label htmlFor="newCohortName">Nombre de la convocatoria</label>
                  <input
                    id="newCohortName"
                    type="text"
                    value={newCohortName}
                    onChange={(e) => setNewCohortName(e.target.value)}
                    placeholder="Ej. Contratistas Octubre 2026"
                  />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <label htmlFor="newCohortKey">Clave (opcional)</label>
                  <div className="input-with-btn">
                    <input
                      id="newCohortKey"
                      type="text"
                      value={newCohortKey}
                      onChange={(e) => setNewCohortKey(e.target.value)}
                      placeholder="Vacia = publica"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setNewCohortKey(generateKey())}
                    >
                      Generar
                    </button>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={createCohort}
                  disabled={creatingCohort || !newCohortName.trim()}
                  style={{ alignSelf: "flex-end" }}
                >
                  {creatingCohort ? "Creando..." : "Crear convocatoria"}
                </button>
              </div>

              <div className="cohort-list">
                {loadingCohorts ? (
                  <Loader text="Cargando convocatorias..." />
                ) : cohorts.length === 0 ? (
                  <div className="empty-state">
                    Aun no hay convocatorias. Crea una para compartir el enlace.
                  </div>
                ) : (
                  cohorts.map((c) => (
                    <div key={c.id} className="cohort-item">
                      <div className="cohort-head">
                        <span className="cohort-name">{c.name}</span>
                        <span
                          className={`badge ${
                            c.active ? "badge-active" : "badge-inactive"
                          }`}
                        >
                          {c.active ? "● Abierta" : "● Cerrada"}
                        </span>
                        <span className="badge badge-user">
                          {c.attendances} asistente(s)
                        </span>
                        {c.hasAccessKey && (
                          <span className="badge badge-group">
                            Clave: {c.accessKey}
                          </span>
                        )}
                      </div>
                      <div className="cohort-actions">
                        <a
                          href={`/capacitacion/${cohortsOf.id}?c=${c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost"
                        >
                          Ver
                        </a>
                        <button
                          className="btn btn-ghost"
                          onClick={() => viewCohortAttendances(cohortsOf, c)}
                        >
                          Ver asistencia
                        </button>
                        <button
                          className={`btn ${
                            c.active ? "btn-warning" : "btn-success"
                          }`}
                          onClick={() => toggleCohort(c)}
                          disabled={cohortBusyId === c.id}
                        >
                          {cohortBusyId === c.id
                            ? "..."
                            : c.active
                            ? "Cerrar"
                            : "Abrir"}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => setCohortToDelete(c)}
                          disabled={cohortBusyId === c.id}
                        >
                          Eliminar
                        </button>

                        {/* Compartir: icono a la derecha */}
                        <span className="cohort-share">
                          <button
                            className="icon-btn"
                            onClick={() => shareCohort(cohortsOf, c)}
                            title="Compartir: copia enlace y clave listos para pegar"
                            aria-label="Compartir"
                          >
                            <ShareIcon />
                            {sharedCohortId === c.id && (
                              <span className="icon-btn-hint">Copiado!</span>
                            )}
                          </button>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: asistencias de una convocatoria */}
      {viewingCohort && (
        <div className="modal-overlay" onClick={() => setViewingCohort(null)}>
          <div
            className="modal modal-lg"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title" style={{ marginBottom: "0.2rem" }}>
                  Asistencia
                </h3>
                <span className="modal-sub">{viewingCohort.name}</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setViewingCohort(null)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {loadingAtt ? (
                <Loader text="Cargando asistencia..." />
              ) : attendances.length === 0 ? (
                <div className="empty-state">
                  Aun nadie ha registrado asistencia en esta convocatoria.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Cedula</th>
                        <th>Empresa</th>
                        <th>Cargo</th>
                        <th>Fecha y hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendances.map((a) => (
                        <tr key={a.id}>
                          <td data-label="Nombre">{a.fullName}</td>
                          <td data-label="Cedula">{a.idNumber}</td>
                          <td data-label="Empresa">{a.company || "-"}</td>
                          <td data-label="Cargo">{a.position || "-"}</td>
                          <td data-label="Fecha y hora">
                            {formatDateTime(a.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <span className="modal-count">
                {attendances.length} registro(s)
              </span>
              <button
                className="btn btn-primary"
                onClick={() => exportAttendances(viewingCohort, attendances)}
                disabled={attendances.length === 0}
              >
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar capacitacion"
        message={
          toDelete
            ? `Vas a eliminar "${toDelete.title}" con todas sus convocatorias y registros de asistencia. Esta accion no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        danger
        loading={deletingId !== null}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={cohortToDelete !== null}
        title="Eliminar convocatoria"
        message={
          cohortToDelete
            ? `Vas a eliminar la convocatoria "${cohortToDelete.name}" y sus ${cohortToDelete.attendances} registro(s) de asistencia. Esta accion no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        danger
        loading={cohortBusyId !== null}
        onConfirm={confirmDeleteCohort}
        onCancel={() => setCohortToDelete(null)}
      />
    </main>
  );
}
