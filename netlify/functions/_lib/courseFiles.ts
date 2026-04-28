// @ts-expect-error - @types/pdf-parse only types the root entry
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import type { ParsedFile } from "./parseMultipart";

export const ALLOWED_EXTENSIONS = ["pdf", "pptx", "docx", "txt"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CONTENT_CHARS = 40_000;
export const MAX_CONTENT_CHARS_PER_FILE = 12_000;
export const DEFAULT_CHUNK_SIZE = 3_000;
export const DEFAULT_CHUNK_OVERLAP = 400;
export const MIN_CHUNK_SIZE = 1_200;
export const MAX_CHUNK_SIZE = 6_000;

export function getExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

export function isAllowedCourseFile(name: string): boolean {
  return ALLOWED_EXTENSIONS.includes(
    getExt(name) as (typeof ALLOWED_EXTENSIONS)[number]
  );
}

export async function extractTextFromFile(file: ParsedFile): Promise<string> {
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
      return "[PPTX: contenido no extraido localmente en esta version; usar file_search cuando el indice termine de procesarse]";
    }
    return "";
  } catch (err) {
    console.error("extractTextFromFile error", file.filename, err);
    return `[No se pudo extraer texto de ${file.filename}]`;
  }
}

export function clipText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n\n[contenido truncado]`;
}

export function buildCourseContent(
  fileNames: string[],
  extractedTexts: string[]
): string {
  const blocks = fileNames.map((name, index) => {
    const text = clipText((extractedTexts[index] || "").trim(), MAX_CONTENT_CHARS_PER_FILE);
    return `=== ${name} ===\n${text || "[sin contenido legible]"}`;
  });
  const joined = blocks.join("\n\n");
  return clipText(joined, MAX_CONTENT_CHARS);
}

export type CourseChunk = {
  fileName: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  text: string;
  hash: string;
};

export function normalizeChunkingConfig(input?: {
  chunkSize?: number;
  overlap?: number;
}): { chunkSize: number; overlap: number } {
  const requestedSize =
    typeof input?.chunkSize === "number"
      ? Math.floor(input.chunkSize)
      : DEFAULT_CHUNK_SIZE;
  const requestedOverlap =
    typeof input?.overlap === "number"
      ? Math.floor(input.overlap)
      : DEFAULT_CHUNK_OVERLAP;
  const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, requestedSize));
  const overlap = Math.max(0, Math.min(Math.floor(chunkSize / 2), requestedOverlap));
  return { chunkSize, overlap };
}

export function chunkTextSemantically(
  text: string,
  cfg?: { chunkSize?: number; overlap?: number }
): Array<Pick<CourseChunk, "charStart" | "charEnd" | "text" | "hash">> {
  const { chunkSize, overlap } = normalizeChunkingConfig(cfg);
  const source = text.replace(/\r\n/g, "\n").trim();
  if (!source) return [];

  const chunks: Array<Pick<CourseChunk, "charStart" | "charEnd" | "text" | "hash">> = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + chunkSize, source.length);
    if (end < source.length) {
      const paragraphBreak = source.lastIndexOf("\n\n", end);
      const lineBreak = source.lastIndexOf("\n", end);
      const sentenceBreak = Math.max(
        source.lastIndexOf(". ", end),
        source.lastIndexOf("? ", end),
        source.lastIndexOf("! ", end)
      );
      const softFloor = start + Math.floor(chunkSize * 0.55);
      const semanticBreak = [paragraphBreak, lineBreak, sentenceBreak]
        .filter((i) => i >= softFloor)
        .sort((a, b) => b - a)[0];
      if (typeof semanticBreak === "number") {
        end = semanticBreak + 1;
      }
    }
    const chunk = source.slice(start, end).trim();
    if (chunk) {
      chunks.push({
        charStart: start,
        charEnd: end,
        text: chunk,
        hash: hashText(chunk),
      });
    }
    if (end >= source.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function buildCourseChunks(
  fileNames: string[],
  extractedTexts: string[],
  cfg?: { chunkSize?: number; overlap?: number }
): CourseChunk[] {
  const chunks: CourseChunk[] = [];
  for (let i = 0; i < fileNames.length; i += 1) {
    const fileName = fileNames[i] || `archivo-${i + 1}`;
    const text = (extractedTexts[i] || "").trim();
    if (!text) continue;
    const byFile = chunkTextSemantically(text, cfg);
    byFile.forEach((chunk, index) => {
      chunks.push({
        fileName,
        chunkIndex: index,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        text: chunk.text,
        hash: chunk.hash,
      });
    });
  }
  return chunks;
}

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `h${(hash >>> 0).toString(16)}`;
}
