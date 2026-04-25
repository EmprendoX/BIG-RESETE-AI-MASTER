import type { Context } from "@netlify/functions";
import {
  AGENT_RESPONSE_JSON_SCHEMA,
  TUTOR_SYSTEM_PROMPT,
  fillPlaceholders,
} from "./_lib/prompts";
import { errorResponse, getModel, getOpenAI, jsonResponse } from "./_lib/openai";

type ChatMessageIn = {
  role: "user" | "assistant";
  content: string;
};

type Body = {
  courseName?: string;
  courseObjective?: string;
  studentType?: string;
  studentLevel?: string;
  businessCase?: string;
  agentStyle?: string;
  studentName?: string;
  industry?: string;
  businessType?: string;
  mainGoal?: string;
  mainChallenge?: string;
  activeContent?: {
    kind?: string;
    name?: string;
    pageHint?: string;
  };
  vectorStoreId?: string;
  fileIds?: string[];
  messages?: ChatMessageIn[];
  userMessage?: string;
  notesContext?: string;
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

  if (!body.userMessage || !body.userMessage.trim()) {
    return errorResponse(400, "Mensaje vacío.");
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
    typeof body.courseContent === "string" &&
    body.courseContent.trim().length > 0;

  const basePrompt = fillPlaceholders(TUTOR_SYSTEM_PROMPT, body);
  const systemPrompt = hasCourseContent
    ? `${basePrompt}\n\nMATERIAL DEL CURSO:\n${body.courseContent}`
    : basePrompt;

  const history = (body.messages ?? [])
    .slice(-20)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const notesBlock = body.notesContext
    ? `\n\nContexto de las notas actuales del alumno:\n"""${body.notesContext.slice(
        0,
        2000
      )}"""`
    : "";
  const activeContentBlock =
    body.activeContent && body.activeContent.name
      ? `\n\nContenido activo en el visor:\n- Tipo: ${
          body.activeContent.kind || "otro"
        }\n- Nombre: ${body.activeContent.name}\n- Referencia: ${
          body.activeContent.pageHint || "sin referencia"
        }\nSi el usuario pide explicación del material actual, prioriza este contenido activo.`
      : "";

  const input = [
    { role: "system" as const, content: systemPrompt },
    ...history,
    {
      role: "user" as const,
      content: `${body.userMessage}${notesBlock}${activeContentBlock}`,
    },
  ];

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
      input,
      tools,
      text: {
        format: {
          type: "json_schema",
          name: AGENT_RESPONSE_JSON_SCHEMA.name,
          schema: AGENT_RESPONSE_JSON_SCHEMA.schema,
          strict: true,
        },
      },
    });

    const text = response.output_text;
    if (!text) {
      return errorResponse(502, "Respuesta vacía del modelo.");
    }
    const parsed = JSON.parse(text);

    return jsonResponse(200, { success: true, response: parsed });
  } catch (err) {
    console.error("chat error", err);
    return errorResponse(
      500,
      err instanceof Error
        ? err.message
        : "No se pudo conectar con el agente."
    );
  }
};
