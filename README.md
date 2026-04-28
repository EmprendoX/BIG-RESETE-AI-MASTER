# Tutor IA de Cursos

App web (React + Vite + Netlify Functions) que convierte material de curso en una clase guiada por un agente de IA. El alumno sube archivos, configura su curso, conversa con el agente (por texto o voz), guarda notas y las exporta a PDF o Word. Sin base de datos, sin login.

## Stack

- Frontend: React 18 + Vite + TypeScript
- Estado: Zustand + `localStorage` (opcional, ya habilitado)
- Backend: Netlify Functions (TypeScript)
- IA: OpenAI Responses API + Vector Stores (`file_search`) + Whisper (`audio.transcriptions`)
- Exportación: `jspdf` (PDF) y `docx` (Word) en el frontend, con endpoints de respaldo
- Deploy: Netlify (build + functions)

## Requisitos

- Node.js 20+
- Cuenta de OpenAI con API key
- Netlify CLI (`npm i -g netlify-cli`) para desarrollo local con Functions

## Variables de entorno

Copiar `.env.example` a `.env`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_MODEL` debe ser un modelo compatible con la Responses API y `file_search` (por ejemplo `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`).

Las variables se configuran igual en Netlify (Site settings → Environment variables). **La API key nunca se expone al frontend.**

**Prioridad shell vs `.env`:** si en la terminal ejecutas `export OPENAI_API_KEY=...` antes de `netlify dev`, ese valor **no lo sobrescribe** el `.env` del proyecto. Un `export` con texto de ejemplo (p. ej. un placeholder) provoca 401 aunque `.env` tenga una clave real. Arranca con `npx netlify dev` desde la raíz del repo sin ese export, o bien `unset OPENAI_API_KEY` y luego `npx netlify dev`.

Si la clave llegó a mostrarse en un chat o log compartido, **revócala** en [API keys](https://platform.openai.com/account/api-keys) y actualiza `.env`.

## Instalar y correr

```bash
npm install
netlify dev
```

`netlify dev` levanta Vite en `:5173` y las Functions en `:8888`. Abrir `http://localhost:8888`.

Para correr solo el frontend (sin Functions) usar `npm run dev`.

## Scripts

- `npm run dev` — Vite en modo desarrollo
- `npm run build` — typecheck + build de producción (`dist/`)
- `npm run preview` — preview del build
- `npm run typecheck` — validar tipos
- `npm run netlify:dev` — atajo a `netlify dev`

## Estructura

```
src/
  App.tsx, main.tsx, styles.css
  components/  CourseSetup, FileUploader, Classroom, CourseSidebar,
               TutorChat, ChatMessage, VoiceInput, NotesEditor,
               ExportButtons, LoadingState, ErrorMessage
  hooks/       useCourseSession (zustand + persist), useChat,
               useVoiceRecorder, useNotes
  lib/         api.ts, exportPdf.ts, exportDocx.ts,
               localStorage.ts, types.ts
netlify/
  functions/
    upload-course-file.ts     POST multipart -> OpenAI Files + Vector Store
    generate-course-summary.ts  POST JSON -> CourseSummary JSON estricto
    chat.ts                   POST JSON -> AgentResponse JSON estricto
    transcribe.ts             POST multipart -> Whisper
    export-pdf.ts             POST JSON -> PDF (respaldo)
    export-docx.ts            POST JSON -> DOCX (respaldo)
    _lib/openai.ts            cliente compartido
    _lib/parseMultipart.ts    parser multipart con busboy
    _lib/prompts.ts           prompts y esquemas JSON
netlify.toml
```

## Límites importantes

- **Tamaño de archivo:** Netlify Functions tiene un límite de ~6 MB por request. Si los materiales del curso son grandes, subirlos en lotes pequeños o individualmente. La función acepta múltiples archivos en el campo `files`.
- **Expiración de Vector Stores:** los Vector Stores creados en OpenAI expiran automáticamente tras 7 días de inactividad. Para el MVP esto es suficiente; "Nuevo curso" descarta el vector store del estado, aunque no lo borra en OpenAI (se podría agregar un DELETE si hace falta).
- **Costos:** cada mensaje del chat usa `file_search`, lo que añade tokens por contenido recuperado. Considerar modelos *mini* para controlar costos.

## Flujo de datos

```
React
  ↓ fetch /.netlify/functions/*
Netlify Functions
  ↓ openai SDK
OpenAI (Responses + Vector Stores + Whisper)
```

El frontend nunca llama a OpenAI directamente.

## Deploy a Netlify

1. Push del repo a GitHub.
2. En Netlify, "Add new site" → Import from Git → seleccionar el repo.
3. Build command: `npm run build`. Publish: `dist`. Functions: `netlify/functions` (ya configurado en `netlify.toml`).
4. Agregar variables `OPENAI_API_KEY` y `OPENAI_MODEL`.
5. Deploy.

## Criterios de aceptación cubiertos

1. Subir PDF/DOCX/PPTX/TXT
2. Llenar datos del curso con validación
3. Iniciar clase → procesa archivos y genera resumen
4. Agente saluda con primera lección
5. Chat por texto con respuesta estructurada
6. Grabación por voz → transcripción → editable antes de enviar
7. Guardar respuesta o resumen del agente en notas
8. Editor manual de notas
9. Exportar PDF (frontend)
10. Exportar Word (frontend)
11. Botón "Nuevo curso" limpia todo el estado
# BIG-RESETE-AI-MASTER
