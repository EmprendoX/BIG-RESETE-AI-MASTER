import type { Context } from "@netlify/functions";
import { errorResponse, getOpenAI, jsonResponse } from "./_lib/openai";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "GET") {
    return errorResponse(405, "Metodo no permitido.");
  }

  const url = new URL(req.url);
  const vectorStoreId = url.searchParams.get("vectorStoreId")?.trim();
  if (!vectorStoreId) {
    return errorResponse(400, "vectorStoreId es obligatorio.");
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
    const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);

    let status: "processing" | "ready" | "failed" | "not_found";
    if (vectorStore.status === "completed") {
      status = "ready";
    } else if (vectorStore.status === "expired") {
      status = "failed";
    } else if (vectorStore.file_counts.failed > 0) {
      status = "failed";
    } else {
      status = "processing";
    }

    return jsonResponse(200, {
      success: true,
      vectorStoreId,
      status,
    });
  } catch (err) {
    console.error("get-course-index-status error", err);
    return errorResponse(
      500,
      err instanceof Error
        ? err.message
        : "No se pudo consultar el indice del curso."
    );
  }
};
