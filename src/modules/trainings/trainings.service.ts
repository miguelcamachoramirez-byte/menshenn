// Capa de servicio del modulo Capacitaciones.
// Toda la logica de negocio y acceso a datos (Prisma) vive aqui.
// Las rutas de app/api/trainings/** solo validan auth/entrada y llaman a esto.

import { prisma } from "@/lib/prisma";
import type {
  TrainingInput,
  AttendanceInput,
  CohortInput,
  CohortPatch,
} from "./types";

// Error de dominio con status HTTP, para que las rutas respondan correctamente.
export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Normaliza y valida preguntas del cuestionario.
function normalizeQuestions(raw: unknown) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((q: any, i: number) => {
      const question = String(q?.question ?? "").trim();
      const options = Array.isArray(q?.options)
        ? q.options.map((o: any) => String(o).trim()).filter(Boolean)
        : [];
      const correct = Number(q?.correct);
      if (!question || options.length < 2) return null;
      if (Number.isNaN(correct) || correct < 0 || correct >= options.length) {
        return null;
      }
      return {
        question,
        options: JSON.stringify(options),
        correct,
        orden: i,
      };
    })
    .filter(Boolean) as {
    question: string;
    options: string;
    correct: number;
    orden: number;
  }[];
}

function cleanTrainingInput(body: TrainingInput) {
  const title = String(body?.title ?? "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  const content = body?.content ? String(body.content).trim() : null;
  const embedUrl = body?.embedUrl ? String(body.embedUrl).trim() : null;
  const fileUrl = body?.fileUrl ? String(body.fileUrl).trim() : null;
  const minMinutes = Math.max(0, Number(body?.minMinutes) || 0);
  const requireAttendance = body?.requireAttendance !== false;

  if (!title) throw new ServiceError("El titulo es obligatorio.", 400);
  if (!content && !embedUrl && !fileUrl) {
    throw new ServiceError(
      "Agrega contenido, un enlace o un archivo PDF.",
      400
    );
  }
  return {
    title,
    description,
    content,
    embedUrl,
    fileUrl,
    minMinutes,
    requireAttendance,
    questions: normalizeQuestions(body?.questions),
  };
}

// ---------------- Capacitaciones ----------------

export async function listTrainings() {
  const trainings = await prisma.training.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attendances: true } } },
  });
  return trainings.map((t) => ({
    ...t,
    hasAccessKey: Boolean(t.accessKey),
    accessKey: undefined,
  }));
}

export async function createTraining(body: TrainingInput) {
  const data = cleanTrainingInput(body);
  return prisma.training.create({
    data: {
      title: data.title,
      description: data.description,
      content: data.content,
      embedUrl: data.embedUrl,
      fileUrl: data.fileUrl,
      minMinutes: data.minMinutes,
      requireAttendance: data.requireAttendance,
      questions: { create: data.questions },
    },
  });
}

export async function getTrainingForEdit(id: string) {
  const training = await prisma.training.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { orden: "asc" },
        select: { question: true, options: true, correct: true },
      },
    },
  });
  if (!training) throw new ServiceError("La capacitacion no existe.", 404);
  return {
    id: training.id,
    title: training.title,
    description: training.description,
    content: training.content,
    embedUrl: training.embedUrl,
    fileUrl: training.fileUrl,
    minMinutes: training.minMinutes,
    requireAttendance: training.requireAttendance,
    accessKey: training.accessKey,
    questions: training.questions.map((q) => ({
      question: q.question,
      options: JSON.parse(q.options) as string[],
      correct: q.correct,
    })),
  };
}

export async function updateTraining(id: string, body: TrainingInput) {
  const data = cleanTrainingInput(body);
  await prisma.$transaction([
    prisma.trainingQuestion.deleteMany({ where: { trainingId: id } }),
    prisma.training.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        embedUrl: data.embedUrl,
        fileUrl: data.fileUrl,
        minMinutes: data.minMinutes,
        requireAttendance: data.requireAttendance,
        questions: { create: data.questions },
      },
    }),
  ]);
  return { success: true };
}

export async function setTrainingActive(id: string, active: boolean) {
  return prisma.training.update({
    where: { id },
    data: { active },
    select: { id: true, active: true },
  });
}

export async function deleteTraining(id: string) {
  await prisma.training.delete({ where: { id } });
  return { success: true };
}

// ---------------- Vista publica ----------------

// Devuelve los datos para la pagina publica, resolviendo convocatoria y clave.
// preview=true entrega todo el contenido (lo controla la ruta: solo admin).
export async function getPublicTraining(
  id: string,
  opts: { cohortId?: string | null; key?: string | null; preview?: boolean }
) {
  const training = await prisma.training.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      embedUrl: true,
      fileUrl: true,
      minMinutes: true,
      requireAttendance: true,
      active: true,
      questions: {
        orderBy: { orden: "asc" },
        select: { id: true, question: true, options: true },
      },
    },
  });
  if (!training) throw new ServiceError("La capacitacion no existe.", 404);

  const mapQuestions = () =>
    training.questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options) as string[],
    }));

  // Vista previa de admin: todo el contenido, sin convocatoria ni clave
  if (opts.preview) {
    return {
      id: training.id,
      title: training.title,
      description: training.description,
      content: training.content,
      embedUrl: training.embedUrl,
      fileUrl: training.fileUrl,
      minMinutes: training.minMinutes,
      requireAttendance: training.requireAttendance,
      requiresKey: false,
      active: true,
      cohortId: null,
      cohortName: null,
      preview: true,
      locked: false,
      questions: mapQuestions(),
    };
  }

  // Resuelve convocatoria si la capacitacion pide asistencia
  let cohort:
    | { id: string; name: string; accessKey: string | null; active: boolean }
    | null = null;

  if (training.requireAttendance) {
    if (opts.cohortId) {
      cohort = await prisma.trainingCohort.findFirst({
        where: { id: opts.cohortId, trainingId: training.id },
        select: { id: true, name: true, accessKey: true, active: true },
      });
    } else {
      const active = await prisma.trainingCohort.findMany({
        where: { trainingId: training.id, active: true },
        select: { id: true, name: true, accessKey: true, active: true },
        take: 2,
      });
      if (active.length === 1) cohort = active[0];
    }

    if (!cohort) {
      return {
        id: training.id,
        title: training.title,
        description: training.description,
        requireAttendance: true,
        active: false,
        noCohort: true,
        locked: false,
      };
    }

    if (!cohort.active) {
      return {
        id: training.id,
        title: training.title,
        description: training.description,
        requireAttendance: true,
        active: false,
        cohortId: cohort.id,
        cohortName: cohort.name,
        locked: false,
      };
    }
  }

  const requiredKey = training.requireAttendance ? cohort?.accessKey : null;
  const needsKey = Boolean(requiredKey);
  const keyOk = !needsKey || opts.key === requiredKey;

  if (!keyOk) {
    return {
      id: training.id,
      title: training.title,
      description: training.description,
      requiresKey: true,
      active: true,
      cohortId: cohort?.id,
      cohortName: cohort?.name,
      locked: true,
    };
  }

  return {
    id: training.id,
    title: training.title,
    description: training.description,
    content: training.content,
    embedUrl: training.embedUrl,
    fileUrl: training.fileUrl,
    minMinutes: training.minMinutes,
    requireAttendance: training.requireAttendance,
    requiresKey: needsKey,
    active: true,
    cohortId: cohort?.id ?? null,
    cohortName: cohort?.name ?? null,
    locked: false,
    questions: mapQuestions(),
  };
}

// Verifica el cuestionario sin registrar. Devuelve ids de preguntas erradas.
export async function verifyQuiz(
  id: string,
  answers: Record<string, number>
) {
  const training = await prisma.training.findUnique({
    where: { id },
    select: { id: true, questions: { select: { id: true, correct: true } } },
  });
  if (!training) throw new ServiceError("La capacitacion no existe.", 404);
  const wrong = training.questions
    .filter((q) => Number(answers?.[q.id]) !== q.correct)
    .map((q) => q.id);
  return { passed: wrong.length === 0, wrong };
}

// ---------------- Convocatorias ----------------

function mapCohort(c: {
  id: string;
  name: string;
  active: boolean;
  accessKey: string | null;
  createdAt: Date;
  _count?: { attendances: number };
}) {
  return {
    id: c.id,
    name: c.name,
    active: c.active,
    hasAccessKey: Boolean(c.accessKey),
    accessKey: c.accessKey,
    createdAt: c.createdAt,
    attendances: c._count?.attendances ?? 0,
  };
}

export async function listCohorts(trainingId: string) {
  const cohorts = await prisma.trainingCohort.findMany({
    where: { trainingId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { attendances: true } } },
  });
  return cohorts.map(mapCohort);
}

export async function createCohort(trainingId: string, body: CohortInput) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: { id: true },
  });
  if (!training) throw new ServiceError("La capacitacion no existe.", 404);

  const name = String(body?.name ?? "").trim();
  const accessKey = body?.accessKey ? String(body.accessKey).trim() : null;
  if (!name) {
    throw new ServiceError(
      "El nombre de la convocatoria es obligatorio.",
      400
    );
  }
  const cohort = await prisma.trainingCohort.create({
    data: { trainingId, name, accessKey, active: true },
  });
  return mapCohort({ ...cohort, _count: { attendances: 0 } });
}

export async function updateCohort(cohortId: string, body: CohortPatch) {
  const data: { active?: boolean; name?: string; accessKey?: string | null } =
    {};
  if (typeof body?.active === "boolean") data.active = body.active;
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) throw new ServiceError("El nombre no puede quedar vacio.", 400);
    data.name = name;
  }
  if (body?.accessKey !== undefined) {
    const key = body.accessKey ? String(body.accessKey).trim() : "";
    data.accessKey = key || null;
  }
  if (Object.keys(data).length === 0) {
    throw new ServiceError("No hay cambios para aplicar.", 400);
  }
  const cohort = await prisma.trainingCohort.update({
    where: { id: cohortId },
    data,
    include: { _count: { select: { attendances: true } } },
  });
  return mapCohort(cohort);
}

export async function deleteCohort(cohortId: string) {
  await prisma.$transaction([
    prisma.trainingAttendance.deleteMany({ where: { cohortId } }),
    prisma.trainingCohort.delete({ where: { id: cohortId } }),
  ]);
  return { success: true };
}

export async function listCohortAttendance(cohortId: string) {
  return prisma.trainingAttendance.findMany({
    where: { cohortId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------- Asistencia ----------------

export async function registerAttendance(
  trainingId: string,
  body: AttendanceInput
) {
  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    select: {
      id: true,
      active: true,
      requireAttendance: true,
      questions: { select: { id: true, correct: true } },
    },
  });
  if (!training) throw new ServiceError("La capacitacion no existe.", 404);

  const fullName = String(body?.fullName ?? "").trim();
  const idNumber = String(body?.idNumber ?? "").trim();
  const company = body?.company ? String(body.company).trim() : null;
  const position = body?.position ? String(body.position).trim() : null;
  const accessKey = body?.accessKey ? String(body.accessKey) : null;
  const cohortId = body?.cohortId ? String(body.cohortId) : null;
  const answers = body?.answers ?? {};

  if (!cohortId) throw new ServiceError("No se indico la convocatoria.", 400);

  const cohort = await prisma.trainingCohort.findFirst({
    where: { id: cohortId, trainingId: training.id },
    select: { id: true, accessKey: true, active: true },
  });
  if (!cohort) throw new ServiceError("La convocatoria no existe.", 404);
  if (!cohort.active) {
    throw new ServiceError("Esta convocatoria esta cerrada.", 400);
  }
  if (cohort.accessKey && accessKey !== cohort.accessKey) {
    throw new ServiceError("Clave de acceso incorrecta.", 403);
  }
  if (!fullName || !idNumber) {
    throw new ServiceError("El nombre y la cedula son obligatorios.", 400);
  }

  const hasQuiz = training.questions.length > 0;
  if (hasQuiz) {
    const allCorrect = training.questions.every(
      (q) => Number(answers?.[q.id]) === q.correct
    );
    if (!allCorrect) {
      throw new ServiceError(
        "Algunas respuestas son incorrectas. Revisa el contenido e intenta de nuevo.",
        400
      );
    }
  }

  const existing = await prisma.trainingAttendance.findFirst({
    where: { cohortId: cohort.id, idNumber },
  });
  if (existing) {
    throw new ServiceError(
      "Ya registraste tu asistencia a esta convocatoria.",
      409
    );
  }

  return prisma.trainingAttendance.create({
    data: {
      trainingId,
      cohortId: cohort.id,
      fullName,
      idNumber,
      company,
      position,
      passedQuiz: hasQuiz,
    },
  });
}
