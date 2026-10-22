"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Loader from "../../components/Loader";
import EmbedFrame from "../../components/EmbedFrame";

type Question = {
  id: string;
  question: string;
  options: string[];
};

type Training = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  embedUrl: string | null;
  fileUrl: string | null;
  minMinutes: number;
  requireAttendance: boolean;
  requiresKey?: boolean;
  active: boolean;
  locked?: boolean;
  noCohort?: boolean;
  preview?: boolean;
  cohortId?: string | null;
  cohortName?: string | null;
  questions: Question[];
};

function toEmbedUrl(raw: string): string {
  let value = (raw || "").trim();

  // 1) Si pegaron un codigo <iframe ... src="...">, extrae solo el src.
  if (value.includes("<iframe")) {
    const match = value.match(/src=["']([^"']+)["']/i);
    if (match) value = match[1];
  }

  try {
    const u = new URL(value);
    const host = u.hostname.replace("www.", "");

    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return value;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }

    // OneDrive / Office: si es un link de "ver" lo pasamos a "embed"
    if (host.includes("onedrive.live.com") || host.includes("1drv.ms")) {
      // Si ya es embed, se deja; si es /view, se cambia a /embed
      if (u.pathname.includes("/view")) {
        return value.replace("/view", "/embed");
      }
      return value;
    }
    // Office / SharePoint: suelen incluir action=embedview
    if (
      host.includes("officeapps.live.com") ||
      host.includes("sharepoint.com") ||
      host.includes("office.com")
    ) {
      return value;
    }

    // Google Slides / Docs: /pub o /edit -> /embed
    if (host.includes("docs.google.com")) {
      if (u.pathname.includes("/edit")) {
        return value.replace(/\/edit.*$/, "/embed");
      }
      return value;
    }

    return value;
  } catch {
    return value;
  }
}

export default function CapacitacionWizard() {
  const params = useParams();
  const id = String(params?.id ?? "");

  // Convocatoria indicada en la URL (?c=...). La leemos del navegador para no
  // requerir un Suspense boundary con useSearchParams.
  const [cohortId, setCohortId] = useState<string>("");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const c = sp.get("c");
      if (c) setCohortId(c);
      if (sp.get("preview") === "1") setPreview(true);
    }
  }, []);

  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Clave de acceso (si la capacitacion la requiere)
  const [accessKey, setAccessKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);

  // Paso actual del wizard (1=ver, 2=quiz, 3=datos, 4=listo)
  const [step, setStep] = useState(1);

  // Temporizador
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cuestionario
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);

  // Datos del asistente
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTraining(key?: string) {
    const qp = new URLSearchParams();
    if (preview) qp.set("preview", "1");
    if (cohortId) qp.set("c", cohortId);
    if (key) qp.set("key", key);
    const qs = qp.toString() ? `?${qp.toString()}` : "";
    const res = await fetch(`/api/trainings/${id}${qs}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setNotFound(true);
      return null;
    }
    return (await res.json()) as Training;
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await loadTraining();
        if (!data) return;
        setTraining(data);
        if (!data.locked && data.minMinutes > 0) {
          setSecondsLeft(data.minMinutes * 60);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cohortId, preview]);

  async function submitKey(e: FormEvent) {
    e.preventDefault();
    setKeyError(null);
    const data = await loadTraining(keyInput);
    if (data && !data.locked) {
      setAccessKey(keyInput);
      setTraining(data);
      if (data.minMinutes > 0) setSecondsLeft(data.minMinutes * 60);
    } else {
      setKeyError("Clave incorrecta. Intenta de nuevo.");
    }
  }

  // Temporizador del paso 1
  useEffect(() => {
    if (step !== 1 || secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, training]);

  const hasQuiz = (training?.questions?.length ?? 0) > 0;

  // Pasos del wizard segun la configuracion
  const steps = ["Capacitacion", ...(hasQuiz ? ["Cuestionario"] : []), "Datos"];

  function goToAfterViewing() {
    setError(null);
    if (hasQuiz) setStep(2);
    else setStep(3);
  }

  async function verifyQuiz() {
    if (!training) return;
    setError(null);
    const sinResponder = (training.questions ?? []).some(
      (q) => answers[q.id] === undefined
    );
    if (sinResponder) {
      setError("Responde todas las preguntas.");
      return;
    }
    try {
      setVerifying(true);
      const res = await fetch(`/api/trainings/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (data.passed) {
        setWrong([]);
        setStep(3);
      } else {
        setWrong(data.wrong || []);
        setError(
          "Algunas respuestas son incorrectas. Revisa la capacitacion e intenta de nuevo."
        );
      }
    } catch {
      setError("No se pudo verificar. Intenta de nuevo.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !idNumber.trim()) {
      setError("El nombre y la cedula son obligatorios.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`/api/trainings/${id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          idNumber,
          company,
          position,
          answers,
          accessKey,
          cohortId: training?.cohortId ?? cohortId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo registrar la asistencia.");
      }
      setStep(4);
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la asistencia.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <Loader text="Cargando capacitacion..." />
      </main>
    );
  }

  if (notFound || !training) {
    return (
      <main className="container">
        <div className="empty-state">
          La capacitacion no existe o el enlace no es valido.
        </div>
      </main>
    );
  }

  // Vista previa de admin: muestra el contenido tal cual, sin registro ni quiz
  if (training.preview) {
    return (
      <main className="container">
        <div className="preview-banner">
          Vista previa (solo admin). Asi veran el contenido los asistentes. El
          registro de asistencia y el cuestionario no se muestran aqui.
        </div>
        <header className="header">
          <h1>{training.title}</h1>
          {training.description && <p>{training.description}</p>}
        </header>
        {training.content && (
          <section className="card">
            <div className="training-content">{training.content}</div>
          </section>
        )}
        {training.fileUrl && (
          <section className="card" style={{ padding: "0.75rem" }}>
            <div className="training-embed">
              <EmbedFrame
                src={`${training.fileUrl}#toolbar=1&view=FitH`}
                title="Presentacion de la capacitacion"
              />
            </div>
          </section>
        )}
        {training.embedUrl && (
          <section className="card" style={{ padding: "0.75rem" }}>
            <div className="training-embed">
              <EmbedFrame
                src={toEmbedUrl(training.embedUrl)}
                title="Contenido de la capacitacion"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </section>
        )}
        {(training.questions?.length ?? 0) > 0 && (
          <section className="card">
            <h2>Cuestionario ({training.questions.length} pregunta(s))</h2>
            <p className="subtitle">
              Los asistentes deben responder correctamente para registrarse.
            </p>
          </section>
        )}
      </main>
    );
  }

  // Requiere clave y aun no se ha validado
  if (training.locked) {
    return (
      <main className="login-wrap">
        <div className="login-card">
          <h1>{training.title}</h1>
          <p className="subtitle">
            Esta capacitacion requiere una clave de acceso.
          </p>
          {keyError && <div className="error-msg">{keyError}</div>}
          <form onSubmit={submitKey}>
            <div className="field">
              <label htmlFor="key">Clave de acceso</label>
              <input
                id="key"
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Ingresa la clave"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Entrar
            </button>
          </form>
        </div>
      </main>
    );
  }

  // No hay convocatoria valida en el enlace (o ninguna activa)
  if (training.requireAttendance && training.noCohort) {
    return (
      <main className="container">
        <header className="header">
          <h1>{training.title}</h1>
        </header>
        <div className="empty-state">
          Este enlace no tiene una convocatoria activa. Solicita a la empresa el
          enlace correcto de la convocatoria vigente.
        </div>
      </main>
    );
  }

  // Requiere registro pero la convocatoria esta cerrada
  if (training.requireAttendance && !training.active) {
    return (
      <main className="container">
        <header className="header">
          <h1>{training.title}</h1>
          {training.cohortName && (
            <p className="subtitle">Convocatoria: {training.cohortName}</p>
          )}
        </header>
        <div className="empty-state">
          Esta convocatoria esta cerrada. Si ya la realizaste, tu asistencia
          quedo guardada.
        </div>
      </main>
    );
  }

  // Capacitacion solo informativa (no pide registro): muestra el contenido y ya.
  if (!training.requireAttendance) {
    return (
      <main className="container">
        <header className="header">
          <h1>{training.title}</h1>
          {training.description && <p>{training.description}</p>}
        </header>

        {training.content && (
          <section className="card">
            <div className="training-content">{training.content}</div>
          </section>
        )}
        {training.fileUrl && (
          <section className="card" style={{ padding: "0.75rem" }}>
            <div className="training-embed">
              <EmbedFrame
                src={`${training.fileUrl}#toolbar=1&view=FitH`}
                title="Presentacion de la capacitacion"
              />
            </div>
          </section>
        )}
        {training.embedUrl && (
          <section className="card" style={{ padding: "0.75rem" }}>
            <div className="training-embed">
              <EmbedFrame
                src={toEmbedUrl(training.embedUrl)}
                title="Contenido de la capacitacion"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </section>
        )}
      </main>
    );
  }

  const timerActive = secondsLeft > 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  // Indice del paso actual para el indicador (1->0, 2->1, 3->2)
  const currentIdx = step >= 3 ? steps.length - 1 : step - 1;

  return (
    <main className="container">
      <header className="header">
        <h1>{training.title}</h1>
        {training.description && <p>{training.description}</p>}
      </header>

      {/* Indicador de pasos */}
      {step < 4 && (
        <div className="wizard-steps">
          {steps.map((label, i) => (
            <div
              key={label}
              className={`wizard-step ${
                i === currentIdx ? "active" : ""
              } ${i < currentIdx ? "done" : ""}`}
            >
              <span className="wizard-dot">{i < currentIdx ? "✓" : i + 1}</span>
              <span className="wizard-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {/* PASO 1: Ver la capacitacion */}
      {step === 1 && (
        <>
          {training.content && (
            <section className="card">
              <div className="training-content">{training.content}</div>
            </section>
          )}
          {training.fileUrl && (
            <section className="card" style={{ padding: "0.75rem" }}>
              <div className="training-embed">
                <EmbedFrame
                  src={`${training.fileUrl}#toolbar=1&view=FitH`}
                  title="Presentacion de la capacitacion"
                />
              </div>
            </section>
          )}
          {training.embedUrl && (
            <section className="card" style={{ padding: "0.75rem" }}>
              <div className="training-embed">
                <EmbedFrame
                  src={toEmbedUrl(training.embedUrl)}
                  title="Contenido de la capacitacion"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            </section>
          )}

          <section className="card">
            {timerActive && (
              <div className="timer-box">
                Revisa la capacitacion con atencion. Podras continuar en{" "}
                <strong>
                  {mm}:{ss.toString().padStart(2, "0")}
                </strong>
              </div>
            )}
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={goToAfterViewing}
                disabled={timerActive}
              >
                {timerActive
                  ? `Espera ${mm}:${ss.toString().padStart(2, "0")}`
                  : "Continuar"}
              </button>
            </div>
          </section>
        </>
      )}

      {/* PASO 2: Cuestionario */}
      {step === 2 && (
        <section className="card">
          <h2>Cuestionario</h2>
          <p className="subtitle" style={{ marginBottom: "1.2rem" }}>
            Responde correctamente para continuar.
          </p>
          <div className="quiz">
            {training.questions.map((q, qi) => (
              <div
                key={q.id}
                className={`quiz-question ${
                  wrong.includes(q.id) ? "quiz-wrong" : ""
                }`}
              >
                <div className="quiz-q-text">
                  {qi + 1}. {q.question}
                </div>
                <div className="quiz-options">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="quiz-option">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: oi }))
                        }
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions" style={{ gap: "0.6rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              Volver a ver
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={verifyQuiz}
              disabled={verifying}
            >
              {verifying ? "Verificando..." : "Verificar respuestas"}
            </button>
          </div>
        </section>
      )}

      {/* PASO 3: Datos del asistente */}
      {step === 3 && (
        <section className="card">
          <h2>Tus datos</h2>
          <p className="subtitle" style={{ marginBottom: "1.2rem" }}>
            Completa tus datos para dejar constancia de que realizaste esta
            capacitacion.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="fullName">Nombre completo</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Juan Perez"
                />
              </div>
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
                <label htmlFor="company">Empresa (opcional)</label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Empresa contratista"
                />
              </div>
              <div className="field">
                <label htmlFor="position">Cargo (opcional)</label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Ej. Operario"
                />
              </div>
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !fullName.trim() || !idNumber.trim()}
              >
                {submitting ? "Registrando..." : "Confirmar asistencia"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* PASO 4: Confirmado */}
      {step === 4 && (
        <section className="card">
          <div className="attendance-done">
            <div className="done-icon" aria-hidden="true">
              ✓
            </div>
            <h2>¡Asistencia registrada!</h2>
            <p>
              Gracias, {fullName}. Tu participacion en esta capacitacion quedo
              registrada correctamente.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
