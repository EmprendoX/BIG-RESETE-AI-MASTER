import type {
  ChatRequest,
  ChatResponseBody,
  CourseIndexStatusResponse,
  CreateCourseSummaryJobRequest,
  CreateCourseSummaryJobResponse,
  CreateCourseIndexRequest,
  CreateCourseIndexResponse,
  GenerateCourseSummaryRequest,
  GenerateCourseSummaryResponse,
  GetCourseSummaryStatusResponse,
  TranscribeResponse,
  UploadCourseFileResponse,
} from "./types";

const BASE = "/.netlify/functions";
const UPLOAD_RETRY_DELAYS_MS = [600, 1600];
const UPLOAD_TIMEOUT_MS = 45_000;

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status})`);
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function isTransientRequestError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("timeout")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadCourseFiles(
  file: File
): Promise<UploadCourseFileResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= UPLOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        `${BASE}/upload-course-file`,
        {
          method: "POST",
          body: form,
        },
        UPLOAD_TIMEOUT_MS
      );
      const data = await parseJson<UploadCourseFileResponse>(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo procesar el curso.");
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (!isTransientRequestError(err) || attempt >= UPLOAD_RETRY_DELAYS_MS.length) {
        break;
      }
      await sleep(UPLOAD_RETRY_DELAYS_MS[attempt]);
    }
  }
  if (lastErr instanceof DOMException && lastErr.name === "AbortError") {
    throw new Error(
      "La carga tardó demasiado por tu conexión. Reintenta con mejor señal o un archivo más pequeño."
    );
  }
  if (lastErr instanceof Error) {
    throw lastErr;
  }
  throw new Error("No se pudo procesar el curso.");
}

export async function createCourseIndex(
  req: CreateCourseIndexRequest
): Promise<CreateCourseIndexResponse> {
  const res = await fetch(`${BASE}/create-course-index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await parseJson<CreateCourseIndexResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo crear el indice del curso.");
  }
  return data;
}

export async function getCourseIndexStatus(
  vectorStoreId: string
): Promise<CourseIndexStatusResponse> {
  const res = await fetch(
    `${BASE}/get-course-index-status?vectorStoreId=${encodeURIComponent(
      vectorStoreId
    )}`
  );
  const data = await parseJson<CourseIndexStatusResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo consultar el indice del curso.");
  }
  return data;
}

export async function generateCourseSummary(
  req: GenerateCourseSummaryRequest
): Promise<GenerateCourseSummaryResponse> {
  const res = await fetch(`${BASE}/generate-course-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await parseJson<GenerateCourseSummaryResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo procesar el curso.");
  }
  return data;
}

export async function createCourseSummaryJob(
  req: CreateCourseSummaryJobRequest
): Promise<CreateCourseSummaryJobResponse> {
  const res = await fetch(`${BASE}/create-course-summary-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await parseJson<CreateCourseSummaryJobResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo iniciar el resumen del curso.");
  }
  return data;
}

export async function getCourseSummaryStatus(
  jobId: string
): Promise<GetCourseSummaryStatusResponse> {
  const res = await fetch(
    `${BASE}/get-course-summary-status?jobId=${encodeURIComponent(jobId)}`
  );
  const data = await parseJson<GetCourseSummaryStatusResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo consultar el resumen del curso.");
  }
  return data;
}

export async function sendChatMessage(
  req: ChatRequest
): Promise<ChatResponseBody> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const data = await parseJson<ChatResponseBody>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo conectar con el agente.");
  }
  return data;
}

export async function transcribeAudio(
  audio: Blob
): Promise<TranscribeResponse> {
  const form = new FormData();
  const filename = `audio.${audio.type.includes("webm") ? "webm" : "wav"}`;
  form.append("audio", audio, filename);
  const res = await fetch(`${BASE}/transcribe`, {
    method: "POST",
    body: form,
  });
  const data = await parseJson<TranscribeResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo transcribir el audio.");
  }
  return data;
}
