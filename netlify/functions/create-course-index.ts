import type { Context } from "@netlify/functions";
import { buildCourseContent } from "./_lib/courseFiles";
import { errorResponse, getOpenAI, jsonResponse } from "./_lib/openai";

type Body = {
  fileIds?: string[];
  fileNames?: string[];
  extractedTexts?: string[];
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Metodo no permitido.");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return errorResponse(400, "JSON invalido.");
  }

  const fileIds = Array.isArray(body.fileIds)
    ? body.fileIds.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const fileNames = Array.isArray(body.fileNames)
    ? body.fileNames.map((v) => (typeof v === "string" ? v : "archivo"))
    : [];
  const extractedTexts = Array.isArray(body.extractedTexts)
    ? body.extractedTexts.map((v) => (typeof v === "string" ? v : ""))
    : [];

  if (fileIds.length === 0) {
    return errorResponse(400, "No hay archivos para indexar.");
  }

  let openai;
  try {
    openai = getOpenAI();
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "Error de configuracion."
    );
  }

  try {
    const vectorStore = await openai.vectorStores.create({
      name: `course-${Date.now()}`,
      expires_after: { anchor: "last_active_at", days: 7 },
    });

    await openai.vectorStores.fileBatches.create(vectorStore.id, {
      file_ids: fileIds,
    });

    return jsonResponse(200, {
      success: true,
      vectorStoreId: vectorStore.id,
      status: vectorStore.status === "completed" ? "ready" : "processing",
      courseContent: buildCourseContent(fileNames, extractedTexts),
    });
  } catch (err) {
    console.error("create-course-index error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo crear el indice del curso."
    );
  }
};
