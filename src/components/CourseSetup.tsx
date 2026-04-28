import { useState } from "react";
import { Sparkles } from "lucide-react";
import FileUploader from "./FileUploader";
import LoadingState from "./LoadingState";
import ErrorMessage from "./ErrorMessage";
import { useCourseSession } from "../hooks/useCourseSession";
import {
  createCourseSummaryJob,
  createCourseIndex,
  getCourseIndexStatus,
  getCourseSummaryStatus,
  uploadCourseFiles,
} from "../lib/api";
import { clearAllFiles, persistFilesLocally } from "../lib/fileStore";
import type {
  CourseIndexStatus,
  CourseSummary,
  CourseSummaryProgress,
  UploadedCourseFile,
} from "../lib/types";

type Step =
  | "idle"
  | "uploading"
  | "creating_index"
  | "waiting_index"
  | "summarizing";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const INDEX_POLL_INTERVAL_MS = 2500;
const INDEX_WAIT_TIMEOUT_MS = 90_000;
const SUMMARY_POLL_INTERVAL_MS = 2000;
const SUMMARY_WAIT_TIMEOUT_MS = 180_000;

export default function CourseSetup() {
  const {
    setup,
    profile,
    setSetupField,
    files,
    setFiles,
    updateFile,
    startClass,
  } = useCourseSession();

  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [localError, setLocalError] = useState<string | undefined>();
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [summaryProgress, setSummaryProgress] = useState<CourseSummaryProgress>();

  const isLoading = step !== "idle";

  const validate = (): string | null => {
    if (!setup.courseName.trim()) return "El nombre del curso es obligatorio.";
    if (!setup.courseObjective.trim())
      return "El objetivo del curso es obligatorio.";
    if (rawFiles.length === 0)
      return "Debe subirse mínimo un archivo del curso.";
    if (rawFiles.length > MAX_FILES)
      return `Solo puedes subir hasta ${MAX_FILES} archivos por curso.`;
    const tooLarge = rawFiles.find((f) => f.size > MAX_FILE_BYTES);
    if (tooLarge) {
      return `${tooLarge.name} excede el limite de 5 MB por archivo.`;
    }
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
    setSummaryProgress(undefined);

    try {
      setStep("uploading");
      setFiles(files.map((f) => ({ ...f, status: "queued" as const, error: undefined })));

      const uploadedFiles: {
        fileId: string;
        name: string;
        extractedText: string;
      }[] = [];

      for (const file of rawFiles) {
        updateFile(file.name, { status: "uploading", error: undefined });
        const uploaded = await uploadCourseFiles(file);
        if (!uploaded.fileId) {
          throw new Error(`No se pudo subir ${file.name}.`);
        }
        uploadedFiles.push({
          fileId: uploaded.fileId,
          name: file.name,
          extractedText: uploaded.extractedText || "",
        });
        updateFile(file.name, {
          status: "uploaded",
          fileId: uploaded.fileId,
          extractedTextPreview: uploaded.extractedTextPreview,
        });
      }

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

      let vectorStoreId: string | undefined;
      let courseContent = buildFallbackCourseContent(uploadedFiles);
      let indexStatus: CourseIndexStatus = "degraded";
      let indexWarning: string | undefined;

      try {
        setStep("creating_index");
        setFiles(buildFileState(rawFiles, uploadedFiles, "processing"));

        const indexRes = await createCourseIndex({
          fileIds: uploadedFiles.map((f) => f.fileId),
          fileNames: uploadedFiles.map((f) => f.name),
          extractedTexts: uploadedFiles.map((f) => f.extractedText),
        });
        vectorStoreId = indexRes.vectorStoreId;
        courseContent = indexRes.courseContent || courseContent;

        if (vectorStoreId) {
          setStep("waiting_index");
          indexStatus = await waitForIndex(vectorStoreId);
          if (indexStatus === "ready") {
            setFiles(buildFileState(rawFiles, uploadedFiles, "ready"));
          } else {
            indexWarning =
              "El indice del curso no termino a tiempo. Entraras con modo degradado mientras el material termina de procesarse.";
          }
        } else {
          indexWarning =
            "No se pudo crear el indice del curso. Entraras con el material extraido localmente.";
        }
      } catch (err) {
        indexStatus = "degraded";
        indexWarning =
          err instanceof Error
            ? `${err.message} Entraras con modo degradado.`
            : "No se pudo crear el indice del curso. Entraras con modo degradado.";
      }

      if (indexStatus !== "ready") {
        setFiles(buildFileState(rawFiles, uploadedFiles, "processing"));
      }

      setStep("summarizing");
      const summaryReq = {
        courseName: setup.courseName,
        courseObjective: setup.courseObjective,
        studentType: profile.role,
        studentLevel: profile.level,
        businessCase: `${profile.businessType} (${profile.industry})`,
        agentStyle: setup.agentStyle,
        fileIds: uploadedFiles.map((f) => f.fileId),
        fileNames: uploadedFiles.map((f) => f.name),
        extractedTexts: uploadedFiles.map((f) => f.extractedText),
        vectorStoreId: indexStatus === "ready" ? vectorStoreId : undefined,
        courseContent: indexStatus === "ready" ? undefined : courseContent,
        chunking: { chunkSize: 3000, overlap: 400 },
      };
      const summaryJob = await createCourseSummaryJob(summaryReq);
      if (!summaryJob.jobId) {
        throw new Error("No se pudo iniciar el resumen del curso.");
      }
      const summaryRes = await waitForSummaryJob(
        summaryJob.jobId,
        summaryJob.preliminarySummary,
        setSummaryProgress
      );

      startClass({
        fileIds: uploadedFiles.map((f) => f.fileId),
        vectorStoreId,
        indexStatus,
        summary: summaryRes.summary,
        courseContent,
      });
      if (indexWarning) {
        setLocalError(indexWarning);
      }
      setSummaryProgress(undefined);
      setStep("idle");
    } catch (e) {
      setStep("idle");
      setSummaryProgress(undefined);
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
                    ? "Subiendo archivos…"
                    : step === "creating_index"
                    ? "Creando indice del curso…"
                    : step === "waiting_index"
                    ? "Indexando material en OpenAI…"
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
                ? "Paso 1 de 3 — Subiendo archivos a OpenAI."
                : step === "creating_index"
                ? "Paso 2 de 3 — Creando el indice del curso."
                : step === "waiting_index"
                ? "Paso 2 de 3 — Esperando a que OpenAI termine de indexar el material."
                : `Paso 3 de 3 — Preparando el resumen inicial del curso${
                    summaryProgress ? ` (${summaryProgress.percent}%)` : "."
                  }`}
            </strong>
            <span>
              {step === "summarizing"
                ? "La clase puede iniciar con un resumen preliminar mientras termina el analisis completo."
                : "Si el indice tarda demasiado, la clase arrancara en modo degradado para no bloquearte. No cierres la pestana."}
            </span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function buildFileState(
  rawFiles: File[],
  uploadedFiles: {
    fileId: string;
    name: string;
    extractedText: string;
  }[],
  status: "processing" | "ready"
): UploadedCourseFile[] {
  return rawFiles.map((f) => {
    const current = uploadedFiles.find((x) => x.name === f.name);
    return {
      name: f.name,
      size: f.size,
      type: f.type,
      status,
      error: undefined,
      fileId: current?.fileId,
      extractedTextPreview: current?.extractedText.slice(0, 500),
    };
  });
}

function buildFallbackCourseContent(
  files: { name: string; extractedText: string }[]
): string {
  const joined = files
    .map((file) => {
      const text = file.extractedText.trim().slice(0, 12_000);
      return `=== ${file.name} ===\n${text || "[sin contenido legible]"}`;
    })
    .join("\n\n");
  return joined.length > 40_000
    ? `${joined.slice(0, 40_000)}\n\n[contenido truncado]`
    : joined;
}

async function waitForIndex(
  vectorStoreId: string
): Promise<CourseIndexStatus> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < INDEX_WAIT_TIMEOUT_MS) {
    const res = await getCourseIndexStatus(vectorStoreId);
    if (res.status === "ready") return "ready";
    if (res.status === "failed") return "degraded";
    await sleep(INDEX_POLL_INTERVAL_MS);
  }
  return "degraded";
}

async function waitForSummaryJob(
  jobId: string,
  preliminarySummary: CourseSummary | undefined,
  onProgress: (progress: CourseSummaryProgress | undefined) => void
): Promise<{ summary: CourseSummary }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SUMMARY_WAIT_TIMEOUT_MS) {
    const res = await getCourseSummaryStatus(jobId);
    onProgress(res.progress);
    if (res.status === "ready" && res.summary) {
      return { summary: res.summary };
    }
    if (res.status === "failed") {
      break;
    }
    await sleep(SUMMARY_POLL_INTERVAL_MS);
  }
  if (preliminarySummary) {
    return { summary: preliminarySummary };
  }
  throw new Error(
    "El resumen final no termino a tiempo. Intenta de nuevo o reduce el contenido por archivo."
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
