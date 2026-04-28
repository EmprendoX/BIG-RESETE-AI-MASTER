import type { Context } from "@netlify/functions";
import { errorResponse, jsonResponse } from "./_lib/openai";
import { buildPreliminarySummary, type CreateSummaryJobBody } from "./_lib/courseSummaryJobs";
import { db } from "./_lib/supabaseAdmin";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return errorResponse(405, "Metodo no permitido.");
  }

  let body: CreateSummaryJobBody;
  try {
    body = (await req.json()) as CreateSummaryJobBody;
  } catch {
    return errorResponse(400, "JSON invalido.");
  }

  if (!body.courseName?.trim()) {
    return errorResponse(400, "courseName es obligatorio.");
  }

  const hasContent =
    (Array.isArray(body.extractedTexts) && body.extractedTexts.some((v) => Boolean(v?.trim()))) ||
    Boolean(body.courseContent?.trim()) ||
    Boolean(body.vectorStoreId?.trim());

  if (!hasContent) {
    return errorResponse(400, "No hay contenido del curso para analizar.");
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const existing = await db
      .from("course_summary_jobs")
      .select("id,status,preliminary_summary")
      .eq("idempotency_key", idempotencyKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) {
      return errorResponse(500, existing.error.message);
    }
    if (existing.data) {
      return jsonResponse(200, {
        success: true,
        jobId: existing.data.id,
        status: existing.data.status,
        preliminarySummary: existing.data.preliminary_summary,
      });
    }
  }

  const preliminarySummary = buildPreliminarySummary(body);
  const created = await db
    .from("course_summary_jobs")
    .insert({
      status: "queued",
      stage: "chunk",
      total_chunks: 0,
      processed_chunks: 0,
      percent: 0,
      request_payload: body,
      preliminary_summary: preliminarySummary,
      idempotency_key: idempotencyKey ?? null,
      checkpoint: {
        version: 1,
        stage: "chunk",
        nextChunkIndex: 0,
        nextBatchIndex: 0,
        chunkSummaries: [],
        batchSummaries: [],
        chunksBuilt: false,
      },
      attempt_count: 0,
      last_heartbeat_at: new Date().toISOString(),
    })
    .select("id,status,preliminary_summary")
    .single();

  if (created.error || !created.data) {
    return errorResponse(500, created.error?.message || "No se pudo crear el job.");
  }

  await db.from("course_summary_job_logs").insert({
    job_id: created.data.id,
    level: "info",
    event: "job_created",
    data: { source: "create-course-summary-job" },
  });

  const internalToken = process.env.INTERNAL_TOKEN;
  if (!internalToken) {
    return errorResponse(500, "INTERNAL_TOKEN no esta configurado.");
  }
  void fetch(`${new URL(req.url).origin}/.netlify/functions/process-course-summary-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
    },
    body: JSON.stringify({ jobId: created.data.id }),
  }).catch((err) => {
    console.error("dispatch process-course-summary-job error", err);
  });

  return jsonResponse(200, {
    success: true,
    jobId: created.data.id,
    status: created.data.status,
    preliminarySummary: created.data.preliminary_summary,
  });
};
