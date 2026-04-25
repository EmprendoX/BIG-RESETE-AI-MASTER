import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import { saveAs } from "file-saver";
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

function parseInline(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith("**") && p.endsWith("**")) {
        return new TextRun({ text: p.slice(2, -2), bold: true });
      }
      return new TextRun({ text: p });
    });
}

function bodyToParagraphs(content: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = (content || "").split(/\n/);
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "") {
      out.push(new Paragraph({ children: [new TextRun({ text: " " })] }));
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line.replace(/^##\s*/, ""), bold: true })],
        })
      );
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: line.replace(/^#\s*/, ""), bold: true })],
        })
      );
      continue;
    }
    out.push(new Paragraph({ children: parseInline(line) }));
  }
  return out;
}

export async function exportNotesToDocx(notes: NotesDocument): Promise<void> {
  const dateStr = new Date(notes.updatedAt || Date.now()).toLocaleString();
  const header: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: notes.title || notes.courseName || "Notas del curso",
          bold: true,
        }),
      ],
    }),
  ];
  if (notes.courseName) {
    header.push(
      new Paragraph({
        children: [new TextRun({ text: `Curso: ${notes.courseName}` })],
      })
    );
  }
  if (notes.businessCase) {
    header.push(
      new Paragraph({
        children: [new TextRun({ text: `Negocio o caso: ${notes.businessCase}` })],
      })
    );
  }
  header.push(
    new Paragraph({
      children: [new TextRun({ text: `Fecha: ${dateStr}` })],
    })
  );
  header.push(new Paragraph({ children: [new TextRun({ text: " " })] }));

  const doc = new Document({
    sections: [
      {
        children: [...header, ...bodyToParagraphs(notes.content)],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${slugify(notes.title || notes.courseName || "notas")}.docx`;
  saveAs(blob, fileName);
}
