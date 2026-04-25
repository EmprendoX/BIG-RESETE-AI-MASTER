import jsPDF from "jspdf";
import type { NotesDocument } from "./types";

function slugify(s: string): string {
  return (s || "notas")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "notas";
}

export async function exportNotesToPdf(notes: NotesDocument): Promise<void> {
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

  const fileName = `${slugify(notes.title || notes.courseName || "notas")}.pdf`;
  doc.save(fileName);
}
