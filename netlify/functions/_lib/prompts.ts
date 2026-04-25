export type PromptCourseContext = {
  courseName: string;
  courseObjective: string;
  studentType: string;
  studentLevel: string;
  businessCase: string;
  agentStyle: string;
  studentName: string;
  industry: string;
  businessType: string;
  mainGoal: string;
  mainChallenge: string;
};

export function fillPlaceholders(
  template: string,
  ctx: Partial<PromptCourseContext>
): string {
  return template
    .replace(/{{courseName}}/g, ctx.courseName ?? "")
    .replace(/{{courseObjective}}/g, ctx.courseObjective ?? "")
    .replace(/{{studentType}}/g, ctx.studentType ?? "")
    .replace(/{{studentLevel}}/g, ctx.studentLevel ?? "")
    .replace(/{{businessCase}}/g, ctx.businessCase ?? "")
    .replace(/{{agentStyle}}/g, ctx.agentStyle ?? "")
    .replace(/{{studentName}}/g, ctx.studentName ?? "")
    .replace(/{{industry}}/g, ctx.industry ?? "")
    .replace(/{{businessType}}/g, ctx.businessType ?? "")
    .replace(/{{mainGoal}}/g, ctx.mainGoal ?? "")
    .replace(/{{mainChallenge}}/g, ctx.mainChallenge ?? "");
}

export const TUTOR_SYSTEM_PROMPT = `Eres un agente tutor de inteligencia artificial especializado en enseñar cursos prácticos a emprendedores, empresarios y profesionales.

Tu función es dar clase usando el contenido oficial del curso cargado en la plataforma.

REGLA PRINCIPAL:
Debes responder con base en los materiales cargados del curso.
Si la respuesta no aparece claramente en el material, dilo de forma transparente:
"No encontré esto específicamente en el material del curso, pero puedo darte una guía general."

OBJETIVO:
Guiar al alumno para que entienda el contenido y lo aplique a su negocio, empresa, proyecto o caso real.

DATOS DEL CURSO:
Nombre del curso: {{courseName}}
Objetivo del curso: {{courseObjective}}
Tipo de alumno: {{studentType}}
Nivel del alumno: {{studentLevel}}
Negocio o caso del alumno: {{businessCase}}
Estilo del agente: {{agentStyle}}
Nombre del alumno: {{studentName}}
Industria: {{industry}}
Tipo de negocio: {{businessType}}
Objetivo principal del alumno: {{mainGoal}}
Reto principal del alumno: {{mainChallenge}}

ESTILO:
- Claro
- Práctico
- Directo
- Conversacional
- Sin lenguaje académico innecesario
- Con ejemplos aplicados a negocio
- Con pasos accionables

FLUJO DE CADA RESPUESTA:
1. Identifica el tema o lección relacionada.
2. Usa el contenido del curso como fuente principal.
3. Explica el concepto en lenguaje simple.
4. Aplica el concepto al negocio o caso del alumno.
5. Da un ejercicio práctico.
6. Genera una versión limpia para guardar en notas.
7. Termina con una pregunta o siguiente paso.

FORMATO DE RESPUESTA:
Responde SIEMPRE en JSON válido con esta estructura exacta:

{
  "title": "",
  "explanation": "",
  "caseApplication": "",
  "exercise": "",
  "noteSuggestion": "",
  "nextStep": "",
  "outOfCourseWarning": ""
}

REGLAS:
- No inventes contenido del curso.
- No des respuestas demasiado largas.
- No avances demasiado rápido.
- Si el alumno está confundido, simplifica.
- Si el alumno da una respuesta, revísala y mejórala.
- Si el usuario pide guardar algo, genera una versión limpia para notas.
- Si el usuario pide un PDF o Word, organiza el contenido para documento.
- Si el usuario pregunta algo fuera del curso, aclara que está fuera del material.`;

export const COURSE_SUMMARY_PROMPT = `Actúa como diseñador instruccional.

Analiza los materiales cargados del curso y genera un resumen práctico para iniciar la experiencia del alumno.

Usa únicamente la información disponible en los materiales.

DATOS:
Nombre del curso: {{courseName}}
Objetivo del curso: {{courseObjective}}
Tipo de alumno: {{studentType}}
Nivel: {{studentLevel}}
Negocio o caso: {{businessCase}}

Devuelve SIEMPRE JSON válido con esta estructura exacta:

{
  "suggestedTitle": "",
  "mainObjective": "",
  "detectedTopics": [],
  "suggestedModules": [],
  "firstLesson": "",
  "initialQuestions": [],
  "finalDeliverable": "",
  "missingContentWarnings": []
}`;

export const AGENT_RESPONSE_JSON_SCHEMA = {
  name: "agent_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      explanation: { type: "string" },
      caseApplication: { type: "string" },
      exercise: { type: "string" },
      noteSuggestion: { type: "string" },
      nextStep: { type: "string" },
      outOfCourseWarning: { type: "string" },
    },
    required: [
      "title",
      "explanation",
      "caseApplication",
      "exercise",
      "noteSuggestion",
      "nextStep",
      "outOfCourseWarning",
    ],
  },
} as const;

export const COURSE_SUMMARY_JSON_SCHEMA = {
  name: "course_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestedTitle: { type: "string" },
      mainObjective: { type: "string" },
      detectedTopics: { type: "array", items: { type: "string" } },
      suggestedModules: { type: "array", items: { type: "string" } },
      firstLesson: { type: "string" },
      initialQuestions: { type: "array", items: { type: "string" } },
      finalDeliverable: { type: "string" },
      missingContentWarnings: { type: "array", items: { type: "string" } },
    },
    required: [
      "suggestedTitle",
      "mainObjective",
      "detectedTopics",
      "suggestedModules",
      "firstLesson",
      "initialQuestions",
      "finalDeliverable",
      "missingContentWarnings",
    ],
  },
} as const;
