import type { Context } from "@netlify/functions";
import OpenAI, { toFile } from "openai";
import {
  extractTextFromFile,
  getExt,
  isAllowedCourseFile,
  MAX_CONTENT_CHARS_PER_FILE,
  MAX_UPLOAD_BYTES,
} from "./_lib/courseFiles";
import { parseMultipart } from "./_lib/parseMultipart";
import { errorResponse, getOpenAI, jsonResponse } from "./_lib/openai";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Metodo no permitido.");
  }

  let parsed;
  try {
    parsed = await parseMultipart(req, { maxBytes: MAX_UPLOAD_BYTES });
  } catch (err) {
    return errorResponse(
      400,
      err instanceof Error ? err.message : "No se pudo cargar el archivo."
    );
  }

  const file =
    parsed.files.find((f) => f.fieldname === "file") ??
    parsed.files.find((f) => f.fieldname === "files");
  if (!file) {
    return errorResponse(400, "No se pudo cargar el archivo.");
  }

  if (!isAllowedCourseFile(file.filename)) {
    return errorResponse(400, `Formato no permitido: ${file.filename}.`);
  }

  if (file.buffer.byteLength > MAX_UPLOAD_BYTES) {
    return errorResponse(
      400,
      `El archivo ${file.filename} excede el limite permitido de 5 MB.`
    );
  }

  let openai: OpenAI;
  try {
    openai = getOpenAI();
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "Error de configuracion."
    );
  }

  try {
    const extractedText = await extractTextFromFile(file);
    const uploadable = await toFile(file.buffer, file.filename, {
      type: file.mimeType,
    });
    const res = await openai.files.create({
      file: uploadable,
      purpose: "assistants",
    });

    return jsonResponse(200, {
      success: true,
      fileId: res.id,
      filename: file.filename,
      extractedText,
      extractedTextPreview: extractedText
        .slice(0, MAX_CONTENT_CHARS_PER_FILE)
        .trim(),
      extension: getExt(file.filename),
    });
  } catch (err) {
    console.error("upload-course-file error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo procesar el archivo."
    );
  }
};
