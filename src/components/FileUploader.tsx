import { useDropzone } from "react-dropzone";
import { FileText, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useCourseSession } from "../hooks/useCourseSession";
import type { UploadedCourseFile } from "../lib/types";

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "text/plain": [".txt"],
};

type Props = {
  rawFiles: File[];
  onChangeRawFiles: (files: File[]) => void;
};

export default function FileUploader({ rawFiles, onChangeRawFiles }: Props) {
  const files = useCourseSession((s) => s.files);
  const setFiles = useCourseSession((s) => s.setFiles);

  const onDrop = (accepted: File[]) => {
    const current = new Map(rawFiles.map((f) => [f.name, f] as const));
    accepted.forEach((f) => current.set(f.name, f));
    const next = Array.from(current.values());
    onChangeRawFiles(next);

    const meta: UploadedCourseFile[] = next.map((f) => {
      const existing = files.find((x) => x.name === f.name);
      return (
        existing ?? {
          name: f.name,
          size: f.size,
          type: f.type,
          status: "idle",
        }
      );
    });
    setFiles(meta);
  };

  const removeFile = (name: string) => {
    onChangeRawFiles(rawFiles.filter((f) => f.name !== name));
    setFiles(files.filter((f) => f.name !== name));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    onDrop,
    multiple: true,
  });

  return (
    <div className="uploader">
      <div
        {...getRootProps({
          className: `dropzone ${isDragActive ? "dropzone-active" : ""}`,
        })}
      >
        <input {...getInputProps()} />
        <Upload size={22} />
        <p>
          {isDragActive
            ? "Suelta los archivos aquí"
            : "Arrastra archivos o haz clic para seleccionar"}
        </p>
        <span className="dropzone-hint">PDF, PPTX, DOCX o TXT</span>
      </div>

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.name} className={`file-item file-${f.status}`}>
              <FileText size={16} />
              <span className="file-name">{f.name}</span>
              <span className="file-size">{formatSize(f.size)}</span>
              <StatusLabel status={f.status} error={f.error} />
              <button
                type="button"
                className="icon-button"
                onClick={() => removeFile(f.name)}
                aria-label="Eliminar archivo"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusLabel({
  status,
  error,
}: {
  status: UploadedCourseFile["status"];
  error?: string;
}) {
  if (status === "ready")
    return (
      <span className="status status-ready">
        <CheckCircle2 size={14} /> Listo
      </span>
    );
  if (status === "uploading")
    return <span className="status status-uploading">Subiendo…</span>;
  if (status === "processing")
    return <span className="status status-processing">Procesando…</span>;
  if (status === "error")
    return (
      <span className="status status-error">
        <AlertCircle size={14} /> {error || "Error"}
      </span>
    );
  return <span className="status status-idle">Pendiente</span>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
