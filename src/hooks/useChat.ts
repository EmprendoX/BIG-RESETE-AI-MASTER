import { useCallback } from "react";
import { useCourseSession } from "./useCourseSession";
import { sendChatMessage } from "../lib/api";
import type { ChatMessage } from "../lib/types";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat() {
  const {
    setup,
    profile,
    fileIds,
    vectorStoreId,
    indexStatus,
    courseContent,
    activeContent,
    messages,
    notes,
    appendMessage,
    setAgentStatus,
    setGlobalError,
  } = useCourseSession();

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      appendMessage(userMessage);
      setAgentStatus("thinking");
      setGlobalError(undefined);

      try {
        setAgentStatus("searching_course");
        const data = await sendChatMessage({
          courseName: setup.courseName,
          courseObjective: setup.courseObjective,
          studentType: profile.role,
          studentLevel: profile.level,
          businessCase: profile.businessType,
          agentStyle: setup.agentStyle,
          studentName: profile.fullName,
          industry: profile.industry,
          businessType: profile.businessType,
          mainGoal: profile.mainGoal,
          mainChallenge: profile.mainChallenge,
          activeContent,
          vectorStoreId: indexStatus === "ready" ? vectorStoreId : undefined,
          fileIds,
          messages: [...messages, userMessage],
          userMessage: trimmed,
          notesContext: notes.content,
          courseContent,
        });
        setAgentStatus("responding");
        if (data.response) {
          const assistantMessage: ChatMessage = {
            id: makeId(),
            role: "assistant",
            content: renderAgentResponseText(data.response),
            createdAt: new Date().toISOString(),
            structured: data.response,
          };
          appendMessage(assistantMessage);
        }
        setAgentStatus("idle");
      } catch (err) {
        setAgentStatus("error");
        setGlobalError(
          err instanceof Error
            ? err.message
            : "No se pudo conectar con el agente."
        );
      }
    },
    [
      setup,
      profile,
      fileIds,
      vectorStoreId,
      indexStatus,
      courseContent,
      activeContent,
      messages,
      notes.content,
      appendMessage,
      setAgentStatus,
      setGlobalError,
    ]
  );

  return { sendMessage };
}

export function renderAgentResponseText(r: {
  title: string;
  explanation: string;
  caseApplication: string;
  exercise: string;
  noteSuggestion: string;
  nextStep: string;
  outOfCourseWarning?: string;
}): string {
  const parts: string[] = [];
  if (r.title) parts.push(`Título: ${r.title}`);
  if (r.explanation) parts.push(`Explicación: ${r.explanation}`);
  if (r.caseApplication) parts.push(`Aplicación a tu caso: ${r.caseApplication}`);
  if (r.exercise) parts.push(`Ejercicio: ${r.exercise}`);
  if (r.noteSuggestion) parts.push(`Para guardar en tus notas: ${r.noteSuggestion}`);
  if (r.nextStep) parts.push(`Siguiente paso: ${r.nextStep}`);
  if (r.outOfCourseWarning) parts.push(`Aviso: ${r.outOfCourseWarning}`);
  return parts.join("\n\n");
}
