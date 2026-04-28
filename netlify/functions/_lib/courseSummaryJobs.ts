export type CourseSummaryJobStatus = "queued" | "processing" | "ready" | "failed";
export type CourseSummaryStage = "chunk" | "batch" | "final";

export type CreateSummaryJobBody = {
  courseName?: string;
  courseObjective?: string;
  studentType?: string;
  studentLevel?: string;
  businessCase?: string;
  agentStyle?: string;
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
  fileNames?: string[];
  extractedTexts?: string[];
  chunking?: {
    chunkSize?: number;
    overlap?: number;
  };
};

export type CourseSummary = {
  suggestedTitle: string;
  mainObjective: string;
  detectedTopics: string[];
  suggestedModules: string[];
  firstLesson: string;
  initialQuestions: string[];
  finalDeliverable: string;
  missingContentWarnings: string[];
};

export type CourseSummaryProgress = {
  totalChunks: number;
  processedChunks: number;
  percent: number;
  stage: CourseSummaryStage;
};

export type CourseSummaryJob = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: CourseSummaryJobStatus;
  request: CreateSummaryJobBody;
  progress: CourseSummaryProgress;
  preliminarySummary?: CourseSummary;
  summary?: CourseSummary;
  error?: string;
};

export function buildPreliminarySummary(body: CreateSummaryJobBody): CourseSummary {
  const name = (body.courseName || "Curso").trim();
  const objective = (body.courseObjective || "").trim();
  return {
    suggestedTitle: name,
    mainObjective: objective || "Objetivo inicial en procesamiento.",
    detectedTopics: objective ? [objective] : [],
    suggestedModules: ["Introduccion", "Fundamentos", "Aplicacion practica"],
    firstLesson: "Resumen preliminar generado mientras se completa el analisis completo.",
    initialQuestions: [
      "Que resultado concreto quieres lograr al terminar este curso?",
      "Que parte del material te genera mas dudas hoy?",
    ],
    finalDeliverable: "Plan de aplicacion practica adaptado al caso del alumno.",
    missingContentWarnings: ["Resumen preliminar en proceso de actualizacion."],
  };
}
