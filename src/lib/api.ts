import type {
  ChatRequest,
  ChatResponseBody,
  GenerateCourseSummaryRequest,
  GenerateCourseSummaryResponse,
  TranscribeResponse,
  UploadCourseFileResponse,
} from "./types";

const BASE = "/.netlify/functions";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status})`);
  }
}

export async function uploadCourseFiles(
  files: File[]
): Promise<UploadCourseFileResponse> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f, f.name));
  const res = await fetch(`${BASE}/upload-course-file`, {
    method: "POST",
    body: form,
  });
  const data = await parseJson<UploadCourseFileResponse>(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudo procesar el curso.");
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
