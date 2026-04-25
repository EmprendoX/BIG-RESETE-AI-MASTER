import { Mic, Square } from "lucide-react";
import LoadingState from "./LoadingState";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

type Props = {
  onText: (text: string) => void;
  disabled?: boolean;
};

export default function VoiceInput({ onText, disabled }: Props) {
  const { start, stop, voiceStatus } = useVoiceRecorder(onText);

  if (voiceStatus === "recording") {
    return (
      <button
        type="button"
        className="btn btn-danger"
        onClick={stop}
        aria-label="Detener grabación"
      >
        <Square size={14} fill="currentColor" /> Detener
      </button>
    );
  }

  if (voiceStatus === "transcribing") {
    return (
      <button type="button" className="btn btn-ghost" disabled>
        <LoadingState inline label="Transcribiendo…" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={start}
      disabled={disabled}
      aria-label="Grabar voz"
      title="Grabar voz"
    >
      <Mic size={14} /> Voz
    </button>
  );
}
