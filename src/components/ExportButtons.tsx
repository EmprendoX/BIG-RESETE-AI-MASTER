import { FileDown, FileText } from "lucide-react";
import LoadingState from "./LoadingState";
import { useCourseSession } from "../hooks/useCourseSession";
import { exportNotesToPdf } from "../lib/exportPdf";
import { exportNotesToDocx } from "../lib/exportDocx";

export default function ExportButtons() {
  const { notes, exportStatus, setExportStatus, setGlobalError } =
    useCourseSession();

  const onPdf = async () => {
    setGlobalError(undefined);
    setExportStatus("generating_pdf");
    try {
      await exportNotesToPdf(notes);
      setExportStatus("pdf_ready");
      setTimeout(() => setExportStatus("idle"), 800);
    } catch {
      setExportStatus("error");
      setGlobalError("No se pudo exportar el documento.");
    }
  };

  const onDocx = async () => {
    setGlobalError(undefined);
    setExportStatus("generating_docx");
    try {
      await exportNotesToDocx(notes);
      setExportStatus("docx_ready");
      setTimeout(() => setExportStatus("idle"), 800);
    } catch {
      setExportStatus("error");
      setGlobalError("No se pudo exportar el documento.");
    }
  };

  const isPdfLoading = exportStatus === "generating_pdf";
  const isDocxLoading = exportStatus === "generating_docx";

  return (
    <div className="export-buttons">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onPdf}
        disabled={isPdfLoading || isDocxLoading || !notes.content.trim()}
      >
        {isPdfLoading ? (
          <LoadingState inline label="PDF…" />
        ) : (
          <>
            <FileDown size={14} /> Exportar PDF
          </>
        )}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onDocx}
        disabled={isPdfLoading || isDocxLoading || !notes.content.trim()}
      >
        {isDocxLoading ? (
          <LoadingState inline label="Word…" />
        ) : (
          <>
            <FileText size={14} /> Exportar Word
          </>
        )}
      </button>
    </div>
  );
}
