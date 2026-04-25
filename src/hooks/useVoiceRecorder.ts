import { useCallback, useRef } from "react";
import { useCourseSession } from "./useCourseSession";
import { transcribeAudio } from "../lib/api";

export function useVoiceRecorder(onText: (text: string) => void) {
  const { voiceStatus, setVoiceStatus, setGlobalError } = useCourseSession();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    if (voiceStatus === "recording" || voiceStatus === "transcribing") return;
    setGlobalError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        if (blob.size === 0) {
          setVoiceStatus("idle");
          return;
        }
        setVoiceStatus("transcribing");
        try {
          const res = await transcribeAudio(blob);
          if (res.text) {
            onText(res.text);
          }
          setVoiceStatus("ready");
          setTimeout(() => setVoiceStatus("idle"), 600);
        } catch (err) {
          setVoiceStatus("error");
          setGlobalError(
            err instanceof Error
              ? err.message
              : "No se pudo transcribir el audio."
          );
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setVoiceStatus("recording");
    } catch (err) {
      setVoiceStatus("error");
      setGlobalError(
        err instanceof Error
          ? err.message
          : "No se pudo acceder al micrófono."
      );
    }
  }, [voiceStatus, onText, setVoiceStatus, setGlobalError]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopTracks();
      setVoiceStatus("idle");
    }
  }, [setVoiceStatus]);

  return { start, stop, voiceStatus };
}
