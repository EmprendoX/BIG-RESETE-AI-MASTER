import type { Context } from "@netlify/functions";
import { jsPDF } from "jspdf";
import { errorResponse } from "./_lib/openai";

type NotesDoc = {
  title?: string;
  courseName?: string;
  businessCase?: string;
  content?: string;
  updatedAt?: string;
};

function slugify(s: string): string {
  return (s || "notas")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "notas";
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Método no permitido.");
  }

  let notes: NotesDoc;
  try {
    notes = (await req.json()) as NotesDoc;
  } catch {
    return errorResponse(400, "JSON inválido.");
  }

  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 16;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(notes.title || notes.courseName || "Notas del curso", margin, y);
    y += lineHeight * 1.4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    if (notes.courseName) {
      doc.text(`Curso: ${notes.courseName}`, margin, y);
      y += lineHeight;
    }
    if (notes.businessCase) {
      doc.text(`Negocio o caso: ${notes.businessCase}`, margin, y);
      y += lineHeight;
    }
    const dateStr = new Date(notes.updatedAt || Date.now()).toLocaleString();
    doc.text(`Fecha: ${dateStr}`, margin, y);
    y += lineHeight * 1.4;

    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += lineHeight;

    doc.setTextColor(20);
    doc.setFontSize(11);

    const paragraphs = (notes.content || "").split(/\n/);
    for (const raw of paragraphs) {
      const line = raw.trimEnd();
      if (line === "") {
        y += lineHeight * 0.6;
        continue;
      }
      let content = line;
      let bold = false;
      if (line.startsWith("## ")) {
        content = line.replace(/^##\s*/, "");
        bold = true;
        doc.setFontSize(13);
      } else if (line.startsWith("# ")) {
        content = line.replace(/^#\s*/, "");
        bold = true;
        doc.setFontSize(15);
      } else {
        doc.setFontSize(11);
      }
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const wrapped = doc.splitTextToSize(content, maxWidth) as string[];
      for (const w of wrapped) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(w, margin, y);
        y += lineHeight;
      }
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));
    const fileName = `${slugify(notes.title || notes.courseName || "notas")}.pdf`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("export-pdf error", err);
    return errorResponse(
      500,
      err instanceof Error ? err.message : "No se pudo exportar el documento."
    );
  }
};
