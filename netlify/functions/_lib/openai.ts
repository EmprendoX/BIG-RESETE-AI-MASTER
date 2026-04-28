import OpenAI from "openai";

let client: OpenAI | null = null;

function assertUsableOpenAiApiKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith("sk-")) {
    throw new Error(
      "OPENAI_API_KEY no parece válida (debe empezar por sk-). Obtén una clave en https://platform.openai.com/account/api-keys"
    );
  }
  const hint = trimmed.toLowerCase();
  if (
    hint.includes("aqui_tu") ||
    hint.includes("your_api_key") ||
    hint.includes("placeholder")
  ) {
    throw new Error(
      "OPENAI_API_KEY parece un placeholder de tutorial. Si usas .env con una clave real, no exportes OPENAI_API_KEY en la misma línea que netlify dev (el shell tiene prioridad). Ejecuta: unset OPENAI_API_KEY && npx netlify dev"
    );
  }
}

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada.");
  }
  assertUsableOpenAiApiKey(apiKey);
  client = new OpenAI({ apiKey });
  return client;
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function jsonResponse(
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(status: number, error: string): Response {
  return jsonResponse(status, { success: false, error });
}

type RetryOptions = {
  timeoutMs?: number;
  retries?: number;
  onRetry?: (attempt: number, err: unknown) => Promise<void> | void;
};

export async function withTimeoutAndRetry<T>(
  runner: (signal: AbortSignal) => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 22_000;
  const retries = opts?.retries ?? 1;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await runner(controller.signal);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      if (opts?.onRetry) {
        await opts.onRetry(attempt + 1, err);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("OpenAI request failed.");
}
