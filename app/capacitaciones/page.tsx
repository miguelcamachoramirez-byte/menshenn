"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Loader from "../components/Loader";
import ConfirmDialog from "../components/ConfirmDialog";

type Training = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  embedUrl: string | null;
  fileUrl: string | null;
  active: boolean;
  requireAttendance: boolean;
  hasAccessKey: boolean;
  groupLabel: string | null;
  createdAt: string;
  _count: { attendances: number };
};

type Attendance = {
  id: string;
  fullName: string;
  idNumber: string;
  company: string | null;
  position: string | null;
  groupLabel: string | null;
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  // Modo del contenido incrustado: pegar enlace o subir PDF
  const [mediaMode, setMediaMode] = useState<"pdf" | "link">("link");
  const [minMinutes, setMinMinutes] = useState(0);
  const [requireAttendance, setRequireAttendance] = useState(true);
  const [useKey, setUseKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dialogo para iniciar un grupo/convocatoria nuevo (rota la clave)
  const [rotating, setRotating] = useState<Training | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [newGroupKey, setNewGroupKey] = useState("");
  const [rotatingBusy, setRotatingBusy] = useState(false);

  // Modo edicion: si tiene id, el form edita en vez de crear
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);

  // Preguntas del cuestionario (opcional)
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

  // Asistencias que se estan viendo
  const [viewing, setViewing] = useState<Training | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    setUseKey(false);
    setAccessKey("");
    setGroupLabel("");
    setQuestions([]);
  }

  // Sube un PDF a Supabase y guarda su URL en fileUrl
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
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

  // Carga una capacitacion en el formulario para editarla
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
      // Si tiene PDF y no enlace, abre en modo PDF; si no, modo enlace
      setMediaMode(d.fileUrl && !d.embedUrl ? "pdf" : "link");
      setMinMinutes(d.minMinutes ?? 0);
      setRequireAttendance(d.requireAttendance !== false);
      setUseKey(Boolean(d.accessKey));
      setAccessKey(d.accessKey ?? "");
      setGroupLabel(d.groupLabel ?? "");
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
      // Sube la vista al formulario
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
      // Filtra preguntas validas (con texto y al menos 2 opciones con texto)
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
        // Solo se envia el contenido del modo activo; el otro queda vacio
        embedUrl: mediaMode === "link" ? embedUrl : "",
        fileUrl: mediaMode === "pdf" ? fileUrl : "",
        minMinutes,
        requireAttendance,
        accessKey: requireAttendance && useKey ? accessKey : "",
        groupLabel: requireAttendance ? groupLabel : "",
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
        throw new Error(
          data.error ||
            (editingId
              ? "No se pudo guardar la capacitacion."
              : "No se pudo crear la capacitacion.")
        );
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
      if (viewing?.id === t.id) setViewing(null);
    } catch (err: any) {
      setError(err.message || "No se pudo eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(t: Training) {
    setError(null);
    try {
      setTogglingId(t.id);
      const res = await fetch(`/api/trainings/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar.");
      }
      setItems((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, active: !t.active } : x))
      );
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar.");
    } finally {
      setTogglingId(null);
    }
  }

  // Inicia un grupo/convocatoria nuevo: cambia la clave (bloquea al grupo
  // anterior) y etiqueta las nuevas asistencias con el nombre del grupo.
  async function confirmRotateGroup() {
    const t = rotating;
    if (!t) return;
    if (!newGroup.trim()) {
      setError("Escribe el nombre del grupo o convocatoria.");
      return;
    }
    setError(null);
    try {
      setRotatingBusy(true);
      const res = await fetch(`/api/trainings/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rotateGroup",
          groupLabel: newGroup.trim(),
          accessKey: newGroupKey.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo iniciar el grupo.");
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...x,
                groupLabel: newGroup.trim(),
                hasAccessKey: Boolean(newGroupKey.trim()),
                active: true,
              }
            : x
        )
      );
      setRotating(null);
      setNewGroup("");
      setNewGroupKey("");
    } catch (err: any) {
      setError(err.message || "No se pudo iniciar el grupo.");
    } finally {
      setRotatingBusy(false);
    }
  }

  async function viewAttendances(t: Training) {
    setViewing(t);
    setAttendances([]);
    try {
      setLoadingAtt(true);
      const res = await fetch(`/api/trainings/${t.id}/attendance`, {
        cache: "no-store",
      });
      if (res.ok) setAttendances(await res.json());
    } finally {
      setLoadingAtt(false);
    }
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/capacitacion/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function csvCell(v: string) {
    const s = v ?? "";
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportAttendances(t: Training, rows: Attendance[]) {
    const header = [
      "Nombre",
      "Cedula",
      "Empresa",
      "Cargo",
      "Grupo",
      "Fecha y hora",
    ];
    const lines = rows.map((r) =>
      [
        csvCell(r.fullName),
        csvCell(r.idNumber),
        csvCell(r.company ?? ""),
        csvCell(r.position ?? ""),
        csvCell(r.groupLabel ?? ""),
        csvCell(formatDateTime(r.createdAt)),
      ].join(";")
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia-${t.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="container">
      <div className="topbar">
        <div className="user-info">Capacitaciones</div>
        <div className="topbar-actions">
          <Link href="/" className="nav-link">
            Volver a reportes
          </Link>
        </div>
      </div>

      <header className="header">
        <h1>Capacitaciones</h1>
        <p>
          Crea capacitaciones, comparte el enlace publico y lleva el registro
          de asistencia.
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
                Elige como mostrar el material: sube un PDF (lo mas confiable
                para PowerPoint) o pega un enlace. Tambien puedes dejarlo solo
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
                    (publica, sin pedir datos ni cuestionario).
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
            {requireAttendance && (
              <div className="field full">
                <div className="key-row">
                  <label className="switch-row" style={{ flex: "0 0 auto" }}>
                    <input
                      type="checkbox"
                      checked={useKey}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setUseKey(on);
                        // No autogenera: el admin la escribe o usa "Generar".
                        if (!on) setAccessKey("");
                      }}
                    />
                    <span>Proteger con clave de acceso</span>
                  </label>

                  {useKey && (
                    <div className="input-with-btn key-input">
                      <input
                        id="accessKey"
                        type="text"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="Escribe la clave"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setAccessKey(generateKey())}
                      >
                        Generar
                      </button>
                    </div>
                  )}
                </div>
                <span className="field-help">
                  Por defecto la capacitacion es publica. Activa esto para que
                  solo quien tenga la clave pueda entrar.
                </span>
              </div>
            )}

            {requireAttendance && (
              <div className="field full">
                <label htmlFor="groupLabel">
                  Grupo / convocatoria actual (opcional)
                </label>
                <input
                  id="groupLabel"
                  type="text"
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  placeholder="Ej. Contratistas Octubre 2026"
                />
                <span className="field-help">
                  Nombra la tanda de personas que haran esta capacitacion. Las
                  asistencias quedan etiquetadas con este grupo. Luego puedes
                  iniciar un grupo nuevo desde la lista para bloquear al
                  anterior.
                </span>
              </div>
            )}
          </div>

          {/* Cuestionario opcional (solo si pide asistencia) */}
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
                      <>
                        <span className="badge badge-user">
                          {t._count.attendances} asistente(s)
                        </span>
                        <span
                          className={`badge ${
                            t.active ? "badge-active" : "badge-inactive"
                          }`}
                        >
                          {t.active ? "● Activa" : "● Desactivada"}
                        </span>
                        {t.hasAccessKey && (
                          <span className="badge badge-user">Con clave</span>
                        )}
                        {t.groupLabel && (
                          <span className="badge badge-group">
                            Grupo: {t.groupLabel}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="badge badge-user">Informativa</span>
                    )}
                  </div>
                  <div className="training-actions">
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
                      onClick={() => copyLink(t.id)}
                    >
                      {copiedId === t.id ? "Copiado!" : "Copiar enlace"}
                    </button>
                    {t.requireAttendance && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => viewAttendances(t)}
                      >
                        Ver asistencia
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => startEdit(t)}
                      disabled={loadingEdit === t.id}
                    >
                      {loadingEdit === t.id ? "..." : "Editar"}
                    </button>
                    {t.requireAttendance && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setRotating(t);
                          setNewGroup("");
                          setNewGroupKey("");
                          setError(null);
                        }}
                      >
                        Nuevo grupo
                      </button>
                    )}

                    {/* Acciones de estado, a la derecha */}
                    <span className="training-actions-right">
                      {t.requireAttendance && (
                        <button
                          className={`btn ${
                            t.active ? "btn-warning" : "btn-success"
                          }`}
                          onClick={() => toggleActive(t)}
                          disabled={togglingId === t.id}
                        >
                          {togglingId === t.id
                            ? "..."
                            : t.active
                            ? "Desactivar"
                            : "Activar"}
                        </button>
                      )}
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

      {/* Panel de asistencias */}
      {viewing && (
        <div className="modal-overlay" onClick={() => setViewing(null)}>
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
                <span className="modal-sub">{viewing.title}</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setViewing(null)}
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
                  Aun nadie ha registrado asistencia.
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
                        <th>Grupo</th>
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
                          <td data-label="Grupo">{a.groupLabel || "-"}</td>
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
                onClick={() => exportAttendances(viewing, attendances)}
                disabled={attendances.length === 0}
              >
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: iniciar un grupo/convocatoria nuevo */}
      {rotating && (
        <div className="modal-overlay" onClick={() => setRotating(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 className="modal-title" style={{ marginBottom: "0.2rem" }}>
                  Iniciar grupo nuevo
                </h3>
                <span className="modal-sub">{rotating.title}</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setRotating(null)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p className="field-help" style={{ marginBottom: "1rem" }}>
                Al iniciar un grupo nuevo se cambia la clave de acceso, de modo
                que el grupo anterior ya no podra entrar. Las nuevas asistencias
                quedaran etiquetadas con este grupo. Las asistencias anteriores
                se conservan.
              </p>
              <div className="field full" style={{ marginBottom: "0.9rem" }}>
                <label htmlFor="newGroup">Nombre del grupo / convocatoria</label>
                <input
                  id="newGroup"
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="Ej. Contratistas Noviembre 2026"
                  autoFocus
                />
              </div>
              <div className="field full">
                <label htmlFor="newGroupKey">
                  Nueva clave de acceso (opcional)
                </label>
                <div className="input-with-btn">
                  <input
                    id="newGroupKey"
                    type="text"
                    value={newGroupKey}
                    onChange={(e) => setNewGroupKey(e.target.value)}
                    placeholder="Dejala vacia para que sea publica"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setNewGroupKey(generateKey())}
                  >
                    Generar
                  </button>
                </div>
                <span className="field-help">
                  Si dejas la clave vacia, cualquiera con el enlace podra
                  entrar al nuevo grupo.
                </span>
              </div>
            </div>

            <div className="modal-foot">
              <button
                className="btn btn-ghost"
                onClick={() => setRotating(null)}
                disabled={rotatingBusy}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmRotateGroup}
                disabled={rotatingBusy || !newGroup.trim()}
              >
                {rotatingBusy ? "Iniciando..." : "Iniciar grupo"}
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
            ? `Vas a eliminar "${toDelete.title}" y todos sus registros de asistencia. Esta accion no se puede deshacer.`
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
