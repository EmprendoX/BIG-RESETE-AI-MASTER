import { useRef, useState } from "react";
import {
  BookmarkPlus,
  UserRound,
  Bot,
  AlertTriangle,
  Volume2,
  Pause,
  Square,
} from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../lib/types";
import { useNotes } from "../hooks/useNotes";

type Props = {
  message: ChatMessageType;
};

export default function ChatMessage({ message }: Props) {
  const { appendAgentResponse, appendNoteSuggestion } = useNotes();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <div className="msg-avatar msg-avatar-user">
          <UserRound size={14} />
        </div>
        <div className="msg-bubble">
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  const s = message.structured;
  const textToSpeak = s ? buildSpeakText(s) : message.content;

  const startSpeaking = () => {
    if (!("speechSynthesis" in window) || !textToSpeak.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "es-ES";
    utterance.rate = 1;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pauseOrResume = () => {
    if (!("speechSynthesis" in window) || !isSpeaking) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const stopSpeaking = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return (
    <div className="msg msg-assistant">
      <div className="msg-avatar msg-avatar-assistant">
        <Bot size={14} />
      </div>
      <div className="msg-bubble">
        {s ? (
          <div className="agent-card">
            {s.outOfCourseWarning ? (
              <div className="agent-warning">
                <AlertTriangle size={14} />
                <span>{s.outOfCourseWarning}</span>
              </div>
            ) : null}
            {s.title ? <h4 className="agent-title">{s.title}</h4> : null}
            {s.explanation ? (
              <Section title="Explicación" text={s.explanation} />
            ) : null}
            {s.caseApplication ? (
              <Section title="Aplicación a tu caso" text={s.caseApplication} />
            ) : null}
            {s.exercise ? (
              <Section title="Ejercicio" text={s.exercise} />
            ) : null}
            {s.noteSuggestion ? (
              <Section
                title="Para guardar en tus notas"
                text={s.noteSuggestion}
              />
            ) : null}
            {s.nextStep ? (
              <Section title="Siguiente paso" text={s.nextStep} />
            ) : null}

            <div className="agent-actions">
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={() => appendAgentResponse(s)}
                title="Guardar respuesta completa en notas"
              >
                <BookmarkPlus size={13} /> Guardar respuesta
              </button>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={() => appendNoteSuggestion(s)}
                title="Guardar solo la versión limpia para notas"
              >
                <BookmarkPlus size={13} /> Guardar resumen
              </button>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={startSpeaking}
                title="Escuchar respuesta"
              >
                <Volume2 size={13} /> Escuchar
              </button>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={pauseOrResume}
                title="Pausar o reanudar audio"
                disabled={!isSpeaking}
              >
                <Pause size={13} /> {isPaused ? "Reanudar" : "Pausar"}
              </button>
              <button
                type="button"
                className="btn btn-subtle btn-sm"
                onClick={stopSpeaking}
                title="Detener audio"
                disabled={!isSpeaking}
              >
                <Square size={13} /> Detener
              </button>
            </div>
          </div>
        ) : (
          <p className="agent-plain">{message.content}</p>
        )}
      </div>
    </div>
  );
}

function buildSpeakText(s: NonNullable<ChatMessageType["structured"]>): string {
  return [s.title, s.explanation, s.caseApplication, s.exercise, s.nextStep]
    .filter(Boolean)
    .join(". ");
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div className="agent-section">
      <span className="agent-section-label">{title}</span>
      <p>{text}</p>
    </div>
  );
}
