import {
  clear as idbClear,
  del as idbDel,
  get as idbGet,
  keys as idbKeys,
  set as idbSet,
  createStore,
} from "idb-keyval";

export type FileKind = "pdf" | "docx" | "txt" | "pptx" | "image" | "other";

export type FileEntry = {
  name: string;
  kind: FileKind;
  mime: string;
  size: number;
  blob: Blob;
  text?: string;
  savedAt: string;
};

const store = createStore("ai-course-files", "entries");

export function kindFromFile(file: { name: string; type: string }): FileKind {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (
    type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    name.endsWith(".pptx")
  )
    return "pptx";
  if (
    type.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  )
    return "image";
  if (type === "text/plain" || name.endsWith(".txt")) return "txt";
  return "other";
}

export async function saveFileEntry(entry: FileEntry): Promise<void> {
  await idbSet(entry.name, entry, store);
}

export async function getFileEntry(name: string): Promise<FileEntry | undefined> {
  return (await idbGet<FileEntry>(name, store)) ?? undefined;
}

export async function hasFileEntry(name: string): Promise<boolean> {
  const e = await idbGet<FileEntry>(name, store);
  return Boolean(e && e.blob);
}

export async function listFileEntries(): Promise<FileEntry[]> {
  const ks = await idbKeys(store);
  const entries: FileEntry[] = [];
  for (const k of ks) {
    const entry = await idbGet<FileEntry>(k as string, store);
    if (entry) entries.push(entry);
  }
  return entries;
}

export async function removeFileEntry(name: string): Promise<void> {
  await idbDel(name, store);
}

export async function clearAllFiles(): Promise<void> {
  await idbClear(store);
}

export type PersistResult = {
  ok: number;
  failed: { name: string; reason: string }[];
};

async function extractTextFromFile(
  file: File,
  kind: FileKind
): Promise<string | undefined> {
  if (kind === "txt") {
    try {
      return await file.text();
    } catch {
      return "";
    }
  }
  if (kind === "docx") {
    try {
      const mod: any = await import("mammoth");
      const api = mod.default ?? mod;
      const arrayBuffer = await file.arrayBuffer();
      const result = await api.extractRawText({ arrayBuffer });
      return (result?.value as string | undefined) ?? "";
    } catch {
      return "";
    }
  }
  return undefined;
}

export async function persistFilesLocally(
  files: File[]
): Promise<PersistResult> {
  const failed: { name: string; reason: string }[] = [];
  let ok = 0;
  for (const file of files) {
    try {
      const kind = kindFromFile(file);
      const text = await extractTextFromFile(file, kind);
      const entry: FileEntry = {
        name: file.name,
        kind,
        mime: file.type || "application/octet-stream",
        size: file.size,
        blob: file,
        text,
        savedAt: new Date().toISOString(),
      };
      await saveFileEntry(entry);
      ok += 1;
    } catch (e) {
      const reason =
        e instanceof Error ? e.message : "No se pudo guardar el archivo";
      failed.push({ name: file.name, reason });
    }
  }
  return { ok, failed };
}
