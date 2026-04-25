import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  Maximize2,
  MessageSquarePlus,
  Minus,
  NotebookPen,
  Plus,
  Copy as CopyIcon,
  AlertCircle,
  FileWarning,
  Upload,
  Paperclip,
  Youtube,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import CourseSidebar from "./CourseSidebar";
import { useCourseSession } from "../hooks/useCourseSession";
import {
  getFileEntry,
  listFileEntries,
  persistFilesLocally,
  type FileEntry,
} from "../lib/fileStore";
import { normalizePdfText } from "../lib/textCleanup";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

type SelectionBox = {
  text: string;
  top: number;
  left: number;
};

export default function CoursePdfViewer() {
  const files = useCourseSession((s) => s.files);
  const appendChatDraft = useCourseSession((s) => s.appendChatDraft);
  const appendNotesContent = useCourseSession((s) => s.appendNotesContent);
  const requestTab = useCourseSession((s) => s.requestTab);
  const setActiveContent = useCourseSession((s) => s.setActiveContent);

  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<FileEntry | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<"material" | "youtube">("material");
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [youtubeEmbedUrl, setYoutubeEmbedUrl] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const viewerHostRef = useRef<HTMLDivElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) return;
    const update = () => setContainerWidth(host.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, [activeEntry?.kind, pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await listFileEntries();
        if (cancelled) return;
        const ordered: FileEntry[] = [];
        for (const meta of files) {
          const match = all.find((e) => e.name === meta.name);
          if (match) ordered.push(match);
        }
        for (const e of all) {
          if (!ordered.some((x) => x.name === e.name)) ordered.push(e);
        }
        setEntries(ordered);
        setActiveName((prev) => {
          if (prev && ordered.some((e) => e.name === prev)) return prev;
          return ordered.length > 0 ? ordered[0].name : null;
        });
      } catch {
        setEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    let revokeUrl: string | null = null;
    if (!activeName) {
      setActiveEntry(null);
      setPdfUrl(null);
      setImageUrl(null);
      return;
    }
    (async () => {
      const entry = await getFileEntry(activeName);
      if (cancelled) return;
      setActiveEntry(entry ?? null);
      setNumPages(0);
      setCurrentPage(0);
      setLoadError(null);
      setScale(1);
      setFitWidth(true);
      if (entry?.kind === "pdf" && entry.blob) {
        const url = URL.createObjectURL(entry.blob);
        revokeUrl = url;
        setPdfUrl(url);
        setImageUrl(null);
      } else if (entry?.kind === "image" && entry.blob) {
        const url = URL.createObjectURL(entry.blob);
        revokeUrl = url;
        setImageUrl(url);
        setPdfUrl(null);
      } else {
        setPdfUrl(null);
        setImageUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [activeName]);

  useEffect(() => {
    if (contentTab === "youtube" && youtubeEmbedUrl) {
      setActiveContent({
        kind: "youtube",
        name: youtubeUrlInput || "Video YouTube",
      });
      return;
    }
    if (!activeEntry) return;
    setActiveContent({
      kind: activeEntry.kind,
      name: activeEntry.name,
      pageHint:
        activeEntry.kind === "pdf" && numPages > 0
          ? `Página ${currentPage + 1} de ${numPages}`
          : undefined,
    });
  }, [
    contentTab,
    youtubeEmbedUrl,
    youtubeUrlInput,
    activeEntry,
    currentPage,
    numPages,
    setActiveContent,
  ]);

  const pdfFile = useMemo(
    () => (pdfUrl ? { url: pdfUrl } : null),
    [pdfUrl]
  );

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoadError(null);
    },
    []
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setLoadError(err?.message || "No se pudo cargar el PDF.");
  }, []);

  const goPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(0, p - 1));
  }, []);
  const goNext = useCallback(() => {
    setCurrentPage((p) =>
      numPages > 0 ? Math.min(numPages - 1, p + 1) : p
    );
  }, [numPages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (!bodyRef.current) return;
      if (
        document.activeElement &&
        !bodyRef.current.contains(document.activeElement)
      )
        return;
      if (activeEntry?.kind !== "pdf") return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeEntry?.kind, goPrev, goNext]);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    const body = bodyRef.current;
    if (!sel || sel.rangeCount === 0 || !body) {
      setSelection(null);
      return;
    }
    const text = sel.toString();
    if (!text.trim()) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const node =
      common.nodeType === 1 ? (common as Element) : common.parentElement;
    if (!node || !body.contains(node)) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelection(null);
      return;
    }
    const top = rect.top - bodyRect.top - 8;
    const left = Math.min(
      Math.max(rect.left - bodyRect.left + rect.width / 2, 60),
      bodyRect.width - 60
    );
    setSelection({ text, top, left });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const text = sel.toString();
      if (!text) return;
      const clean = normalizePdfText(text);
      if (!clean) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", clean);
    };
    body.addEventListener("copy", onCopy);
    return () => body.removeEventListener("copy", onCopy);
  }, [activeEntry?.name]);

  const sendToChat = useCallback(() => {
    if (!selection) return;
    const clean = normalizePdfText(selection.text);
    if (!clean) return;
    appendChatDraft(clean);
    requestTab("chat");
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, appendChatDraft, requestTab]);

  const sendToNotes = useCallback(() => {
    if (!selection) return;
    const clean = normalizePdfText(selection.text);
    if (!clean) return;
    appendNotesContent(clean);
    requestTab("notes");
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, [selection, appendNotesContent, requestTab]);

  const copyClean = useCallback(async () => {
    if (!selection) return;
    const clean = normalizePdfText(selection.text);
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = clean;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  }, [selection]);

  const downloadCurrent = () => {
    if (!activeEntry) return;
    const url = URL.createObjectURL(activeEntry.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeEntry.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const zoomIn = useCallback(() => {
    setFitWidth(false);
    setScale((s) => Math.min(MAX_SCALE, +(s + 0.1).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setFitWidth(false);
    setScale((s) => Math.max(MIN_SCALE, +(s - 0.1).toFixed(2)));
  }, []);

  const zoomFitWidth = useCallback(() => {
    setFitWidth(true);
  }, []);

  const missingFiles = useMemo(
    () =>
      files
        .map((f) => f.name)
        .filter((n) => !entries.some((e) => e.name === n)),
    [files, entries]
  );

  const onAttachLocal = useCallback(async (incoming: File[]) => {
    if (incoming.length === 0) return;
    setAttaching(true);
    setAttachError(null);
    try {
      const result = await persistFilesLocally(incoming);
      if (result.failed.length > 0) {
        const detail = result.failed
          .map((f) => `${f.name}: ${f.reason}`)
          .join(" · ");
        setAttachError(
          result.ok > 0
            ? `Algunos archivos no se pudieron guardar. ${detail}`
            : `No se pudo guardar el archivo. ${detail}`
        );
      }
      setReloadToken((v) => v + 1);
    } catch (e) {
      setAttachError(
        e instanceof Error ? e.message : "No se pudo guardar el archivo."
      );
    } finally {
      setAttaching(false);
    }
  }, []);

  const openAttachPicker = () => attachInputRef.current?.click();

  const onAttachInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const arr = Array.from(list);
    e.target.value = "";
    void onAttachLocal(arr);
  };

  const onDropAttach = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const list = e.dataTransfer?.files;
    if (!list || list.length === 0) return;
    void onAttachLocal(Array.from(list));
  };

  const showEmptyAttach = entries.length === 0 && files.length > 0;
  const showMissingBanner = entries.length > 0 && missingFiles.length > 0;
  const showYouTube = youtubeEmbedUrl && contentTab === "youtube";

  const zoomLabel = fitWidth ? "Ajuste" : `${Math.round(scale * 100)}%`;
  const pageWidthForRender =
    fitWidth && containerWidth > 0 ? containerWidth - 16 : undefined;

  return (
    <div className="pdf-viewer">
      <div className="content-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`content-tab ${contentTab === "material" ? "active" : ""}`}
          aria-selected={contentTab === "material"}
          onClick={() => setContentTab("material")}
        >
          <FileText size={13} /> Material
        </button>
        <button
          type="button"
          role="tab"
          className={`content-tab ${contentTab === "youtube" ? "active" : ""}`}
          aria-selected={contentTab === "youtube"}
          onClick={() => setContentTab("youtube")}
        >
          <Youtube size={13} /> YouTube
        </button>
      </div>

      {contentTab === "youtube" ? (
        <div className="youtube-toolbar">
          <input
            type="url"
            value={youtubeUrlInput}
            placeholder="Pega URL de YouTube"
            onChange={(e) => setYoutubeUrlInput(e.target.value)}
            className="youtube-input"
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setYoutubeEmbedUrl(toYouTubeEmbed(youtubeUrlInput))}
          >
            Cargar video
          </button>
        </div>
      ) : null}

      <div className="pdf-info-collapsible">
        <button
          type="button"
          className="pdf-info-toggle"
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
        >
          <Info size={14} />
          <span>Info del curso</span>
          {infoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {infoOpen ? (
          <div className="pdf-info-body">
            <CourseSidebar />
          </div>
        ) : null}
      </div>

      {entries.length > 1 && contentTab === "material" ? (
        <div className="pdf-file-tabs" role="tablist">
          {entries.map((e) => (
            <button
              key={e.name}
              role="tab"
              aria-selected={e.name === activeName}
              className={`pdf-file-tab ${
                e.name === activeName ? "active" : ""
              }`}
              onClick={() => setActiveName(e.name)}
              title={e.name}
            >
              <FileText size={12} />
              <span>{e.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="pdf-toolbar">
        {contentTab === "material" ? (
          <>
            {activeEntry?.kind === "pdf" ? (
              <>
                <div className="pdf-toolbar-group">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={goPrev}
                    disabled={currentPage <= 0}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="pdf-page-indicator">
                    {numPages > 0 ? `${currentPage + 1} / ${numPages}` : "—"}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={goNext}
                    disabled={numPages === 0 || currentPage >= numPages - 1}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="pdf-toolbar-group">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={zoomOut}
                    aria-label="Alejar"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="pdf-zoom-indicator">{zoomLabel}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={zoomIn}
                    aria-label="Acercar"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={zoomFitWidth}
                    aria-label="Ajustar al ancho"
                    title="Ajustar al ancho"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div className="pdf-toolbar-group">
                <span className="pdf-file-name" title={activeEntry?.name}>
                  {activeEntry?.name ?? "Sin archivo"}
                </span>
              </div>
            )}
            <div className="pdf-toolbar-group pdf-toolbar-right">
              <button
                type="button"
                className="icon-button"
                onClick={downloadCurrent}
                disabled={!activeEntry || contentTab !== "material"}
                aria-label="Descargar"
                title="Descargar"
              >
                <Download size={14} />
              </button>
            </div>
          </>
        ) : (
          <span className="muted">Estás viendo YouTube</span>
        )}
      </div>

      <input
        ref={attachInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.pptx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
        style={{ display: "none" }}
        onChange={onAttachInputChange}
      />

      {showMissingBanner && contentTab === "material" ? (
        <div className="pdf-missing-banner">
          <AlertCircle size={14} />
          <span>
            Faltan {missingFiles.length} archivo(s) del curso en este
            dispositivo.
          </span>
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={openAttachPicker}
            disabled={attaching}
          >
            <Paperclip size={12} /> Adjuntar
          </button>
        </div>
      ) : null}

      {attachError ? (
        <div className="pdf-error pdf-error-banner">
          <AlertCircle size={14} />
          <span>{attachError}</span>
        </div>
      ) : null}

      <div className="pdf-body" ref={bodyRef}>
        {showYouTube ? (
          <div className="youtube-wrap">
            <iframe
              title="Video YouTube"
              src={youtubeEmbedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="youtube-iframe"
            />
          </div>
        ) : contentTab === "youtube" ? (
          <div className="pdf-empty">
            <Youtube size={20} />
            <p className="muted">
              Pega una URL válida de YouTube para mostrar el video en el aula.
            </p>
          </div>
        ) : showEmptyAttach ? (
          <div
            className={`pdf-attach-empty ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropAttach}
          >
            <Upload size={22} />
            <h4>Adjuntá tus archivos para visualizarlos</h4>
            <p className="muted">
              No re-subimos nada al agente; solo se guardan en tu navegador
              para este visor.
            </p>
            <ul className="pdf-attach-expected">
              {files.map((f) => (
                <li key={f.name}>
                  <FileText size={12} />
                  <span>{f.name}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openAttachPicker}
              disabled={attaching}
            >
              <Paperclip size={13} />
              {attaching ? "Guardando…" : "Seleccionar archivos"}
            </button>
          </div>
        ) : !activeEntry ? (
          <div className="pdf-empty">
            <FileWarning size={20} />
            <p className="muted">
              No hay archivos disponibles para el visor. Empezá un nuevo
              curso para subir material.
            </p>
          </div>
        ) : activeEntry.kind === "pdf" ? (
          <div className="pdf-viewer-host" ref={viewerHostRef}>
            {pdfFile ? (
              loadError ? (
                <div className="pdf-empty">
                  <FileWarning size={18} />
                  <p className="muted">
                    No se pudo cargar el PDF: {loadError}
                  </p>
                </div>
              ) : (
                <Document
                  key={activeName ?? "pdf"}
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="pdf-loading">Preparando archivo…</div>
                  }
                  error={
                    <div className="pdf-empty">
                      <FileWarning size={18} />
                      <p className="muted">
                        No se pudo cargar el PDF.
                      </p>
                    </div>
                  }
                >
                  {numPages > 0 ? (
                    <Page
                      pageNumber={currentPage + 1}
                      scale={fitWidth ? undefined : scale}
                      width={pageWidthForRender}
                      renderTextLayer
                      renderAnnotationLayer={false}
                      loading={
                        <div className="pdf-loading">Renderizando página…</div>
                      }
                    />
                  ) : null}
                </Document>
              )
            ) : (
              <div className="pdf-loading">Preparando archivo…</div>
            )}
          </div>
        ) : activeEntry.kind === "image" ? (
          <div className="image-wrap">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={activeEntry.name}
                className="content-image"
              />
            ) : null}
          </div>
        ) : activeEntry.kind === "txt" || activeEntry.kind === "docx" ? (
          <div className="pdf-text-wrap">
            {activeEntry.text && activeEntry.text.trim().length > 0 ? (
              <pre className="pdf-text">{activeEntry.text}</pre>
            ) : (
              <div className="pdf-empty">
                <FileWarning size={18} />
                <p className="muted">
                  No se pudo extraer texto de este archivo, pero el agente
                  sí lo leyó en la subida.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="pdf-empty">
            <FileWarning size={18} />
            <p className="muted">
              Formato no soportado para visor ({activeEntry.kind.toUpperCase()}).
              En MVP para PPT/PPTX usamos fallback de descarga con el botón de
              arriba.
            </p>
          </div>
        )}

        {selection ? (
          <div
            className="pdf-selection-bar"
            style={{
              top: Math.max(selection.top, 8),
              left: selection.left,
            }}
          >
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={sendToChat}
              title="Enviar al chat"
            >
              <MessageSquarePlus size={12} /> Al chat
            </button>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={sendToNotes}
              title="Agregar a notas"
            >
              <NotebookPen size={12} /> A notas
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={copyClean}
              title="Copiar limpio"
            >
              <CopyIcon size={12} /> Copiar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function toYouTubeEmbed(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
