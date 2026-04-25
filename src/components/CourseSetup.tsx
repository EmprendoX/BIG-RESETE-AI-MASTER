import { useState } from "react";
import { Sparkles } from "lucide-react";
import FileUploader from "./FileUploader";
import LoadingState from "./LoadingState";
import ErrorMessage from "./ErrorMessage";
import { useCourseSession } from "../hooks/useCourseSession";
import {
  generateCourseSummary,
  uploadCourseFiles,
} from "../lib/api";
import { clearAllFiles, persistFilesLocally } from "../lib/fileStore";

type Step = "idle" | "uploading" | "summarizing";

export default function CourseSetup() {
  const {
    setup,
    profile,
    setSetupField,
    files,
    setFiles,
    startClass,
  } = useCourseSession();

  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [localError, setLocalError] = useState<string | undefined>();
  const [fieldError, setFieldError] = useState<string | undefined>();

  const isLoading = step !== "idle";

  const validate = (): string | null => {
    if (!setup.courseName.trim()) return "El nombre del curso es obligatorio.";
    if (!setup.courseObjective.trim())
      return "El objetivo del curso es obligatorio.";
    if (rawFiles.length === 0)
      return "Debe subirse mínimo un archivo del curso.";
    return null;
  };

  const onStart = async () => {
    setLocalError(undefined);
    const err = validate();
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(undefined);

    try {
      setStep("uploading");
      setFiles(
        files.map((f) => ({ ...f, status: "uploading" as const }))
      );
      const uploaded = await uploadCourseFiles(rawFiles);
      const fileIds = uploaded.fileIds ?? [];
      const vectorStoreId = uploaded.vectorStoreId;
      const courseContent = uploaded.courseContent;
      if (!vectorStoreId) throw new Error("No se pudo procesar el curso.");

      setFiles(
        files.map((f) => ({ ...f, status: "ready" as const }))
      );

      try {
        await clearAllFiles();
      } catch {
        // ignore
      }
      const persistResult = await persistFilesLocally(rawFiles);
      if (persistResult.failed.length > 0) {
        const detail = persistResult.failed
          .map((f) => `${f.name}: ${f.reason}`)
          .join(" · ");
        setLocalError(
          `Algunos archivos no se pudieron guardar para el visor local (podrás adjuntarlos desde el visor). ${detail}`
        );
      }

      setStep("summarizing");
      const summaryRes = await generateCourseSummary({
        courseName: setup.courseName,
        courseObjective: setup.courseObjective,
        studentType: profile.role,
        studentLevel: profile.level,
        businessCase: `${profile.businessType} (${profile.industry})`,
        agentStyle: setup.agentStyle,
        fileIds,
        vectorStoreId,
        courseContent,
      });

      if (!summaryRes.summary) {
        throw new Error("No se pudo procesar el curso.");
      }

      startClass({
        fileIds,
        vectorStoreId,
        summary: summaryRes.summary,
        courseContent,
      });
      setStep("idle");
    } catch (e) {
      setStep("idle");
      setFiles(
        files.map((f) =>
          f.status === "uploading" || f.status === "processing"
            ? { ...f, status: "error", error: "No se pudo cargar el archivo." }
            : f
        )
      );
      setLocalError(
        e instanceof Error ? e.message : "No se pudo procesar el curso."
      );
    }
  };

  return (
    <main className="setup">
      <header className="setup-header">
        <div className="setup-badge">
          <Sparkles size={14} /> Tutor IA de Cursos
        </div>
        <h1 className="setup-title">
          Convierte tu curso en una clase guiada por IA
        </h1>
        <p className="setup-subtitle">
          Sube el material y empieza una clase conversacional aplicada al
          contexto real del alumno.
        </p>
      </header>

      <section className="setup-card">
        <div className="form-grid">
          <Field
            label="Nombre del curso *"
            value={setup.courseName}
            onChange={(v) => setSetupField("courseName", v)}
            placeholder="Ej: Marketing para restaurantes"
            disabled={isLoading}
          />
          <Field
            label="Objetivo del curso *"
            value={setup.courseObjective}
            onChange={(v) => setSetupField("courseObjective", v)}
            placeholder="Ej: Aprender a atraer clientes de forma consistente"
            disabled={isLoading}
          />
          <Field
            label="Estilo del agente"
            value={setup.agentStyle}
            onChange={(v) => setSetupField("agentStyle", v)}
            placeholder="Ej: Directo, práctico, con ejemplos"
            disabled={isLoading}
          />
        </div>
        <div className="setup-profile-summary">
          <strong>Perfil activo:</strong> {profile.fullName || "Sin nombre"} •{" "}
          {profile.role || "Sin rol"} • {profile.businessType || "Sin negocio"} •{" "}
          {profile.level || "Sin nivel"}
        </div>

        <div className="upload-section">
          <h3>Material del curso</h3>
          <p className="help-text">
            Sube uno o más archivos. Formatos aceptados: PDF, PPTX, DOCX, TXT.
          </p>
          <FileUploader
            rawFiles={rawFiles}
            onChangeRawFiles={setRawFiles}
          />
        </div>

        {fieldError ? <ErrorMessage message={fieldError} /> : null}
        {localError ? <ErrorMessage message={localError} /> : null}

        <div className="setup-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onStart}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoadingState
                inline
                label={
                  step === "uploading"
                    ? "Subiendo y procesando archivos…"
                    : "Analizando el material del curso…"
                }
              />
            ) : (
              "Iniciar clase con IA"
            )}
          </button>
        </div>

        {isLoading ? (
          <div className="setup-progress-note">
            <strong>
              {step === "uploading"
                ? "Paso 1 de 2 — Subiendo archivos a OpenAI y creando el índice del curso."
                : "Paso 2 de 2 — El agente está leyendo tu material y preparando el resumen inicial."}
            </strong>
            <span>
              Esto puede tardar entre 30 y 60 segundos la primera vez. No
              cierres la pestaña.
            </span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  textarea?: boolean;
}) {
  const { label, value, onChange, placeholder, disabled, textarea } = props;
  return (
    <label className={`field ${textarea ? "field-full" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </label>
  );
}
