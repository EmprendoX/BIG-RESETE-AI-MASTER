import { useEffect, useState } from "react";
import { RotateCcw, FileText, MessageSquare, StickyNote } from "lucide-react";
import CoursePdfViewer from "./CoursePdfViewer";
import TutorChat from "./TutorChat";
import NotesEditor from "./NotesEditor";
import { useCourseSession } from "../hooks/useCourseSession";
import { useChat } from "../hooks/useChat";

type Tab = "course" | "chat" | "notes";

export default function Classroom() {
  const { setup, profile, summary, messages, resetAll, appendMessage } =
    useCourseSession();
  const requestedTab = useCourseSession((s) => s.requestedTab);
  const consumeRequestedTab = useCourseSession((s) => s.consumeRequestedTab);
  const [tab, setTab] = useState<Tab>("chat");
  useChat();

  useEffect(() => {
    if (requestedTab) {
      setTab(requestedTab);
      consumeRequestedTab();
    }
  }, [requestedTab, consumeRequestedTab]);

  useEffect(() => {
    if (messages.length === 0 && summary) {
      appendMessage({
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: buildWelcomeMessage(summary.firstLesson, summary.suggestedTitle),
        createdAt: new Date().toISOString(),
        structured: {
          title: summary.suggestedTitle || setup.courseName,
          explanation: summary.firstLesson || "",
          caseApplication: "",
          exercise: "",
          noteSuggestion: summary.firstLesson || "",
          nextStep:
            summary.initialQuestions[0] ||
            "¿Sobre qué tema quieres empezar hoy?",
        },
      });
    }
  }, [messages.length, summary, setup.courseName, appendMessage]);

  const onNewCourse = () => {
    const ok = confirm(
      "¿Seguro que quieres empezar un nuevo curso? Se perderán la sesión, chat y notas actuales."
    );
    if (ok) resetAll();
  };

  return (
    <div className="classroom">
      <header className="classroom-header">
        <div className="classroom-title">
          <span className="classroom-course">{setup.courseName}</span>
          <span className="classroom-dot">•</span>
          <span className="classroom-case">
            {profile.fullName || "Alumno"} - {profile.businessType || "Negocio"}
          </span>
        </div>
        <div className="classroom-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onNewCourse}
          >
            <RotateCcw size={14} /> Nuevo curso
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "course"}
          className={`mobile-tab ${tab === "course" ? "active" : ""}`}
          onClick={() => setTab("course")}
        >
          <FileText size={14} /> Curso
        </button>
        <button
          role="tab"
          aria-selected={tab === "chat"}
          className={`mobile-tab ${tab === "chat" ? "active" : ""}`}
          onClick={() => setTab("chat")}
        >
          <MessageSquare size={14} /> Chat
        </button>
        <button
          role="tab"
          aria-selected={tab === "notes"}
          className={`mobile-tab ${tab === "notes" ? "active" : ""}`}
          onClick={() => setTab("notes")}
        >
          <StickyNote size={14} /> Notas
        </button>
      </nav>

      <div className="classroom-grid">
        <aside
          className={`column column-course ${
            tab === "course" ? "active" : ""
          }`}
        >
          <CoursePdfViewer />
        </aside>
        <section
          className={`column column-chat ${tab === "chat" ? "active" : ""}`}
        >
          <TutorChat />
        </section>
        <aside
          className={`column column-notes ${
            tab === "notes" ? "active" : ""
          }`}
        >
          <NotesEditor />
        </aside>
      </div>
    </div>
  );
}

function buildWelcomeMessage(firstLesson: string, title: string): string {
  const greeting = `Hola, soy tu tutor IA. Vamos a trabajar sobre "${title || "tu curso"}".`;
  const lesson = firstLesson
    ? `\n\nPrimera lección:\n${firstLesson}`
    : "\n\n¿Por dónde quieres empezar?";
  return greeting + lesson;
}
