import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("pdfjs-dist") || id.includes("@react-pdf-viewer")) {
            return "pdf-vendor";
          }
          if (id.includes("openai")) {
            return "openai-vendor";
          }
          if (id.includes("mammoth") || id.includes("/docx/")) {
            return "docx-vendor";
          }
          if (
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("file-saver")
          ) {
            return "pdfexport-vendor";
          }
          if (
            id.includes("react") ||
            id.includes("zustand") ||
            id.includes("lucide-react") ||
            id.includes("idb-keyval") ||
            id.includes("react-dropzone")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
