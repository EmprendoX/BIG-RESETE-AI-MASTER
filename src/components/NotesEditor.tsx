import { Eraser } from "lucide-react";
import ExportButtons from "./ExportButtons";
import { useNotes } from "../hooks/useNotes";

export default function NotesEditor() {
  const { notes, setContent, setTitle, clearNotes } = useNotes();

  const onClear = () => {
    const ok = confirm("¿Seguro que quieres limpiar las notas?");
    if (ok) clearNotes();
  };

  return (
    <div className="notes">
      <div className="notes-header">
        <h3>Notas</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          <Eraser size={13} /> Limpiar
        </button>
      </div>

      <label className="field">
        <span>Título de las notas</span>
        <input
          type="text"
          value={notes.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del documento"
        />
      </label>

      <textarea
        className="notes-textarea"
        value={notes.content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escribe notas manuales o guarda respuestas del agente aquí…"
      />

      <ExportButtons />
    </div>
  );
}
