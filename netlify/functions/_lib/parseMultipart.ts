import Busboy from "busboy";
import { Readable } from "node:stream";

export type ParsedFile = {
  fieldname: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type ParsedMultipart = {
  files: ParsedFile[];
  fields: Record<string, string>;
};

export async function parseMultipart(
  req: Request,
  opts?: { maxBytes?: number }
): Promise<ParsedMultipart> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new Error("Contenido no es multipart/form-data.");
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (opts?.maxBytes && contentLength > opts.maxBytes) {
    throw new Error(
      `El archivo excede el limite permitido de ${Math.round(
        opts.maxBytes / 1024 / 1024
      )} MB.`
    );
  }

  const bodyBuffer = Buffer.from(await req.arrayBuffer());
  if (opts?.maxBytes && bodyBuffer.byteLength > opts.maxBytes) {
    throw new Error(
      `El archivo excede el limite permitido de ${Math.round(
        opts.maxBytes / 1024 / 1024
      )} MB.`
    );
  }

  return await new Promise<ParsedMultipart>((resolve, reject) => {
    const busboy = Busboy({ headers: { "content-type": contentType } });

    const files: ParsedFile[] = [];
    const fields: Record<string, string> = {};

    busboy.on("file", (fieldname, file, info) => {
      const chunks: Buffer[] = [];
      file.on("data", (d: Buffer) => chunks.push(d));
      file.on("end", () => {
        files.push({
          fieldname,
          filename: info.filename || "upload",
          mimeType: info.mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        });
      });
      file.on("error", reject);
    });

    busboy.on("field", (name, val) => {
      fields[name] = val;
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve({ files, fields }));
    busboy.on("close", () => resolve({ files, fields }));

    Readable.from(bodyBuffer).pipe(busboy);
  });
}
