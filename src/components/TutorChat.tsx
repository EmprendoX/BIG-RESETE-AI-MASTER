import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import ChatMessage from "./ChatMessage";
import VoiceInput from "./VoiceInput";
import LoadingState from "./LoadingState";
import { useChat } from "../hooks/useChat";
import { useCourseSession } from "../hooks/useCourseSession";

export default function TutorChat() {
  const { messages, agentStatus, ttsAutoplay, setTtsAutoplay } = useCourseSession();
  const chatDraftAppend = useCourseSession((s) => s.chatDraftAppend);
  const consumeChatDraft = useCourseSession((s) => s.consumeChatDraft);
  const { sendMessage } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, agentStatus]);

  useEffect(() => {
    if (!chatDraftAppend) return;
    setInput((prev) =>
      prev ? `${prev}\n\n${chatDraftAppend}` : chatDraftAppend
    );
    consumeChatDraft();
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const len = ta.value.length;
      try {
        ta.setSelectionRange(len, len);
      } catch {
        // ignore
      }
    }
  }, [chatDraftAppend, consumeChatDraft]);

  useEffect(() => {
    if (!ttsAutoplay || !("speechSynthesis" in window) || messages.length === 0) {
      return;
    }
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const text = last.structured
      ? [last.structured.title, last.structured.explanation, last.structured.nextStep]
          .filter(Boolean)
          .join(". ")
      : last.content;
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }, [messages, ttsAutoplay]);

  const isBusy = agentStatus === "thinking" ||
    agentStatus === "searching_course" ||
    agentStatus === "responding";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    const text = input;
    setInput("");
    void sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={scrollRef}>
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {isBusy ? (
          <div className="chat-typing">
            <LoadingState
              inline
              label={
                agentStatus === "searching_course"
                  ? "Buscando en el material del curso…"
                  : agentStatus === "responding"
                  ? "Preparando respuesta…"
                  : "Pensando…"
              }
            />
          </div>
        ) : null}
      </div>

      <form className="chat-form" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta o habla con el agente…"
          rows={2}
          disabled={isBusy}
        />
        <div className="chat-actions">
          <label className="chat-autoplay">
            <input
              type="checkbox"
              checked={ttsAutoplay}
              onChange={(e) => setTtsAutoplay(e.target.checked)}
            />
            Autoplay respuesta
          </label>
          <VoiceInput
            onText={(text) =>
              setInput((prev) => (prev ? `${prev} ${text}` : text))
            }
            disabled={isBusy}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isBusy || !input.trim()}
          >
            <Send size={14} /> Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
