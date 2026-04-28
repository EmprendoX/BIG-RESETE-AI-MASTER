import {
  BATCH_SUMMARY_JSON_SCHEMA,
  BATCH_SUMMARY_PROMPT,
  CHUNK_SUMMARY_JSON_SCHEMA,
  CHUNK_SUMMARY_PROMPT,
  COURSE_SUMMARY_JSON_SCHEMA,
  COURSE_SUMMARY_PROMPT,
  fillPlaceholders,
} from "./prompts";
import { withTimeoutAndRetry } from "./openai";
import type OpenAI from "openai";
import type { CourseChunk } from "./courseFiles";
import type { CreateSummaryJobBody } from "./courseSummaryJobs";

export type ChunkSummary = {
  mainObjective: string;
  detectedTopics: string[];
  keyInsights: string[];
  missingContentWarnings: string[];
  sourceChunkHash: string;
};

export type BatchSummary = {
  mainObjective: string;
  detectedTopics: string[];
  suggestedModules: string[];
  firstLessonIdeas: string[];
  initialQuestions: string[];
  finalDeliverables: string[];
  missingContentWarnings: string[];
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

export async function summarizeChunk(args: {
  openai: OpenAI;
  model: string;
  chunk: CourseChunk;
  timeoutMs?: number;
  retries?: number;
}): Promise<ChunkSummary> {
  const { openai, model, chunk, timeoutMs, retries } = args;
  const prompt =
    `${CHUNK_SUMMARY_PROMPT}\n\nARCHIVO: ${chunk.fileName}\n` +
    `RANGO: ${chunk.charStart}-${chunk.charEnd}\n\nCONTENIDO:\n${chunk.text}`;
  const parsed = await callStructured<ChunkSummary>({
    openai,
    model,
    prompt,
    schemaName: CHUNK_SUMMARY_JSON_SCHEMA.name,
    schema: CHUNK_SUMMARY_JSON_SCHEMA.schema,
    timeoutMs,
    retries,
  });
  return {
    mainObjective: parsed.mainObjective || "",
    detectedTopics: dedupeStrings(parsed.detectedTopics),
    keyInsights: dedupeStrings(parsed.keyInsights),
    missingContentWarnings: dedupeStrings(parsed.missingContentWarnings),
    sourceChunkHash: chunk.hash,
  };
}

export async function summarizeBatch(args: {
  openai: OpenAI;
  model: string;
  batch: ChunkSummary[];
  timeoutMs?: number;
  retries?: number;
}): Promise<BatchSummary> {
  const { openai, model, batch, timeoutMs, retries } = args;
  const content = batch
    .map(
      (item, idx) =>
        `# ${idx + 1}\nobjetivo: ${item.mainObjective}\n` +
        `temas: ${item.detectedTopics.join(", ")}\n` +
        `insights: ${item.keyInsights.join(" | ")}\n` +
        `warnings: ${item.missingContentWarnings.join(" | ")}`
    )
    .join("\n\n");

  const parsed = await callStructured<BatchSummary>({
    openai,
    model,
    prompt: `${BATCH_SUMMARY_PROMPT}\n\nRESUMENES:\n${content}`,
    schemaName: BATCH_SUMMARY_JSON_SCHEMA.name,
    schema: BATCH_SUMMARY_JSON_SCHEMA.schema,
    timeoutMs,
    retries,
  });
  return {
    mainObjective: parsed.mainObjective || "",
    detectedTopics: dedupeStrings(parsed.detectedTopics),
    suggestedModules: dedupeStrings(parsed.suggestedModules),
    firstLessonIdeas: dedupeStrings(parsed.firstLessonIdeas),
    initialQuestions: dedupeStrings(parsed.initialQuestions),
    finalDeliverables: dedupeStrings(parsed.finalDeliverables),
    missingContentWarnings: dedupeStrings(parsed.missingContentWarnings),
  };
}

export async function summarizeFinal(args: {
  openai: OpenAI;
  model: string;
  payload: CreateSummaryJobBody;
  batchSummaries: BatchSummary[];
  timeoutMs?: number;
  retries?: number;
}): Promise<CourseSummary> {
  const { openai, model, payload, batchSummaries, timeoutMs, retries } = args;
  const basePrompt = fillPlaceholders(COURSE_SUMMARY_PROMPT, payload);
  const merged = batchSummaries
    .map(
      (b, i) =>
        `Lote ${i + 1}\nObjetivo: ${b.mainObjective}\nTemas: ${b.detectedTopics.join(
          ", "
        )}\nModulos: ${b.suggestedModules.join(", ")}\nPrimera clase: ${b.firstLessonIdeas.join(
          " | "
        )}\nPreguntas: ${b.initialQuestions.join(" | ")}\nEntregables: ${b.finalDeliverables.join(
          " | "
        )}\nWarnings: ${b.missingContentWarnings.join(" | ")}`
    )
    .join("\n\n");
  const prompt =
    `${basePrompt}\n\nRESUMENES DE LOTES DEL CURSO:\n${merged}\n\n` +
    `Genera el resumen inicial final del curso "${payload.courseName || "sin nombre"}".`;

  return callStructured<CourseSummary>({
    openai,
    model,
    prompt,
    schemaName: COURSE_SUMMARY_JSON_SCHEMA.name,
    schema: COURSE_SUMMARY_JSON_SCHEMA.schema,
    timeoutMs,
    retries,
  });
}

async function callStructured<T extends Record<string, unknown>>(args: {
  openai: OpenAI;
  model: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
}): Promise<T> {
  const { openai, model, prompt, schemaName, schema, timeoutMs, retries } = args;
  let reducedPrompt = false;
  return withTimeoutAndRetry(
    async (signal) => {
      const response = await openai.responses.create(
        {
          model,
          input: [
            {
              role: "user",
              content: reducedPrompt ? shrinkPrompt(prompt) : prompt,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: schemaName,
              schema,
              strict: true,
            },
          },
        },
        { signal }
      );
      const text = response.output_text;
      if (!text) {
        throw new Error("Respuesta vacia del modelo.");
      }
      return JSON.parse(text) as T;
    },
    {
      timeoutMs: timeoutMs ?? 12_000,
      retries: retries ?? 0,
      onRetry: () => {
        reducedPrompt = true;
      },
    }
  );
}

function shrinkPrompt(prompt: string): string {
  const max = Math.floor(prompt.length * 0.6);
  return prompt.length <= max ? prompt : `${prompt.slice(0, max)}\n\n[contenido reducido]`;
}

function dedupeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))].slice(0, 12);
}
