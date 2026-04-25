import { useCallback } from "react";
import { useCourseSession } from "./useCourseSession";
import type { AgentResponse } from "../lib/types";

export function useNotes() {
  const { notes, setNotes, clearNotes } = useCourseSession();

  const appendAgentResponse = useCallback(
    (r: AgentResponse) => {
      const block = [
        `## ${r.title || "Nota"}`,
        "",
        `**Explicación:** ${r.explanation}`,
        "",
        `**Aplicación a tu caso:** ${r.caseApplication}`,
        "",
        `**Ejercicio:** ${r.exercise}`,
        "",
        `**Para guardar:** ${r.noteSuggestion}`,
        "",
        `**Siguiente paso:** ${r.nextStep}`,
        "",
      ].join("\n");
      const current = notes.content.trim();
      const next = current ? `${current}\n\n---\n\n${block}` : block;
      setNotes({ content: next });
    },
    [notes.content, setNotes]
  );

  const appendNoteSuggestion = useCallback(
    (r: AgentResponse) => {
      const block = `## ${r.title || "Nota"}\n\n${r.noteSuggestion}\n`;
      const current = notes.content.trim();
      const next = current ? `${current}\n\n${block}` : block;
      setNotes({ content: next });
    },
    [notes.content, setNotes]
  );

  const setContent = useCallback(
    (content: string) => {
      setNotes({ content });
    },
    [setNotes]
  );

  const setTitle = useCallback(
    (title: string) => {
      setNotes({ title });
    },
    [setNotes]
  );

  return {
    notes,
    setContent,
    setTitle,
    appendAgentResponse,
    appendNoteSuggestion,
    clearNotes,
  };
}
