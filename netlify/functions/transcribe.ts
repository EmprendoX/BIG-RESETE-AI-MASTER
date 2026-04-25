import type { Context } from "@netlify/functions";
import { toFile } from "openai";
import { parseMultipart } from "./_lib/parseMultipart";
import { errorResponse, getOpenAI, jsonResponse } from "./_lib/openai";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Método no permitido.");
  }

  let parsed;
  try {
    parsed = await parseMultipart(req);
  } catch (err) {
    return errorResponse(
      400,
      err instanceof Error ? err.message : "No se pudo transcribir el audio."
    );
  }

  const file =
    parsed.files.find((f) => f.fieldname === "audio") ?? parsed.files[0];
  if (!file) {
    return errorResponse(400, "No se pudo transcribir el audio.");
  }

  let openai;
  try {
    openai = getOpenAI();
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "Error de configuración."
    );
  }

  try {
    const uploadable = await toFile(file.buffer, file.filename, {
      type: file.mimeType,
    });
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: uploadable,
    });
    return jsonResponse(200, { success: true, text: result.text });
  } catch (err) {
    console.error("transcribe error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo transcribir el audio."
    );
  }
};
