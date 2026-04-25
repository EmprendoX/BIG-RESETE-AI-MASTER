export function normalizePdfText(raw: string): string {
  if (!raw) return "";

  let text = raw.replace(/\r\n?/g, "\n");

  text = text.replace(/([A-Za-zÁÉÍÓÚÑáéíóúñüÜ])-\n([A-Za-zÁÉÍÓÚÑáéíóúñüÜ])/g, "$1$2");

  const paragraphs = text.split(/\n{2,}/).map((para) => {
    const joined = para.replace(/\s*\n\s*/g, " ");
    return joined.replace(/[ \t\u00A0]+/g, " ").trim();
  });

  return paragraphs.filter((p) => p.length > 0).join("\n\n").trim();
}
