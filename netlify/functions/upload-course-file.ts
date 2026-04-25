import type { Context } from "@netlify/functions";
import OpenAI, { toFile } from "openai";
// @ts-expect-error - @types/pdf-parse only types the root entry
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { parseMultipart, type ParsedFile } from "./_lib/parseMultipart";
import { errorResponse, getOpenAI, jsonResponse } from "./_lib/openai";

const ALLOWED_EXTENSIONS = ["pdf", "pptx", "docx", "txt"];
const MAX_CONTENT_CHARS = 40_000;

function getExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

async function extractTextFromFile(file: ParsedFile): Promise<string> {
  const ext = getExt(file.filename);
  try {
    if (ext === "pdf") {
      const res = await pdfParse(file.buffer);
      return (res.text || "").trim();
    }
    if (ext === "docx") {
      const res = await mammoth.extractRawText({ buffer: file.buffer });
      return (res.value || "").trim();
    }
    if (ext === "txt") {
      return file.buffer.toString("utf8").trim();
    }
    if (ext === "pptx") {
      return "[PPTX: contenido no extraído en esta versión]";
    }
    return "";
  } catch (err) {
    console.error("extractTextFromFile error", file.filename, err);
    return `[No se pudo extraer texto de ${file.filename}]`;
  }
}

function buildCourseContent(
  files: ParsedFile[],
  extracted: string[]
): string {
  const blocks = files.map((f, i) => {
    const text = (extracted[i] || "").trim();
    return `=== ${f.filename} ===\n${text || "[sin contenido legible]"}`;
  });
  const joined = blocks.join("\n\n");
  if (joined.length <= MAX_CONTENT_CHARS) return joined;
  return joined.slice(0, MAX_CONTENT_CHARS) + "\n\n[contenido truncado]";
}

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
      err instanceof Error ? err.message : "No se pudo cargar el archivo."
    );
  }

  const files = parsed.files.filter(
    (f) => f.fieldname === "files" || f.fieldname === "file"
  );
  if (files.length === 0) {
    return errorResponse(400, "No se pudo cargar el archivo.");
  }

  const invalid = files.find(
    (f) => !ALLOWED_EXTENSIONS.includes(getExt(f.filename))
  );
  if (invalid) {
    return errorResponse(400, `Formato no permitido: ${invalid.filename}.`);
  }

  let openai: OpenAI;
  try {
    openai = getOpenAI();
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "Error de configuración."
    );
  }

  try {
    const extractionPromise = Promise.all(
      files.map((f) => extractTextFromFile(f))
    );

    const uploadPromise = (async () => {
      const uploaded = await Promise.all(
        files.map(async (f) => {
          const uploadable = await toFile(f.buffer, f.filename, {
            type: f.mimeType,
          });
          const res = await openai.files.create({
            file: uploadable,
            purpose: "assistants",
          });
          return res.id;
        })
      );

      const vectorStore = await openai.vectorStores.create({
        name: `course-${Date.now()}`,
      });

      await openai.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
        file_ids: uploaded,
      });

      return { fileIds: uploaded, vectorStoreId: vectorStore.id };
    })();

    const [extracted, uploadResult] = await Promise.all([
      extractionPromise,
      uploadPromise,
    ]);

    const courseContent = buildCourseContent(files, extracted);

    files.forEach((f, i) => {
      console.log(
        `[upload] ${f.filename} → ${(extracted[i] || "").length} chars`
      );
    });
    console.log(`[upload] courseContent total: ${courseContent.length} chars`);

    return jsonResponse(200, {
      success: true,
      fileIds: uploadResult.fileIds,
      vectorStoreId: uploadResult.vectorStoreId,
      courseContent,
    });
  } catch (err) {
    console.error("upload-course-file error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo procesar el curso."
    );
  }
};
