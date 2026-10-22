// Tipos del dominio de Capacitaciones (trainings).
// Centralizados para que rutas, servicio y UI compartan los mismos contratos.

export type QuestionInput = {
  question: string;
  options: string[];
  correct: number;
};

// Datos para crear/editar una capacitacion (desde el admin)
export type TrainingInput = {
  title: string;
  description?: string | null;
  content?: string | null;
  embedUrl?: string | null;
  fileUrl?: string | null;
  minMinutes?: number;
  requireAttendance?: boolean;
  questions?: QuestionInput[];
};

// Datos para registrar asistencia (desde la pagina publica)
export type AttendanceInput = {
  fullName: string;
  idNumber: string;
  company?: string | null;
  position?: string | null;
  cohortId: string;
  accessKey?: string | null;
  answers?: Record<string, number>;
};

// Datos para crear/editar una convocatoria
export type CohortInput = {
  name: string;
  accessKey?: string | null;
};

export type CohortPatch = {
  active?: boolean;
  name?: string;
  accessKey?: string | null;
};
