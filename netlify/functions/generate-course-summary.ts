import type { Context } from "@netlify/functions";
import {
  COURSE_SUMMARY_JSON_SCHEMA,
  COURSE_SUMMARY_PROMPT,
  fillPlaceholders,
} from "./_lib/prompts";
import { errorResponse, getModel, getOpenAI, jsonResponse } from "./_lib/openai";

type Body = {
  courseName?: string;
  courseObjective?: string;
  studentType?: string;
  studentLevel?: string;
  businessCase?: string;
  agentStyle?: string;
  fileIds?: string[];
  vectorStoreId?: string;
  courseContent?: string;
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Método no permitido.");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return errorResponse(400, "JSON inválido.");
  }

  const model = getModel();
  let openai;
  try {
    openai = getOpenAI();
  } catch (err) {
    return errorResponse(
      500,
      err instanceof Error ? err.message : "Error de configuración."
    );
  }

  const hasCourseContent =
    typeof body.courseContent === "string" && body.courseContent.trim().length > 0;

  const basePrompt = fillPlaceholders(COURSE_SUMMARY_PROMPT, body);
  const systemPrompt = hasCourseContent
    ? `${basePrompt}\n\nMATERIAL DEL CURSO:\n${body.courseContent}`
    : basePrompt;

  const userPrompt = hasCourseContent
    ? `Genera el resumen inicial del curso "${
        body.courseName || "sin nombre"
      }" basándote exclusivamente en el MATERIAL DEL CURSO incluido arriba. Devuelve solo el JSON solicitado.`
    : `Genera el resumen inicial del curso "${
        body.courseName || "sin nombre"
      }" para ayudar al alumno a empezar. Revisa los materiales cargados antes de responder y devuelve solo el JSON solicitado.`;

  const tools =
    !hasCourseContent && body.vectorStoreId
      ? [
          {
            type: "file_search" as const,
            vector_store_ids: [body.vectorStoreId],
            max_num_results: 5,
          },
        ]
      : undefined;

  try {
    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      tools,
      text: {
        format: {
          type: "json_schema",
          name: COURSE_SUMMARY_JSON_SCHEMA.name,
          schema: COURSE_SUMMARY_JSON_SCHEMA.schema,
          strict: true,
        },
      },
    });

    const text = response.output_text;
    if (!text) {
      return errorResponse(502, "Respuesta vacía del modelo.");
    }
    const summary = JSON.parse(text);

    return jsonResponse(200, { success: true, summary });
  } catch (err) {
    console.error("generate-course-summary error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo procesar el curso."
    );
  }
};
