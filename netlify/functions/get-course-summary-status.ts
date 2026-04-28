import type { Context } from "@netlify/functions";
import { errorResponse, jsonResponse } from "./_lib/openai";
import { db } from "./_lib/supabaseAdmin";

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "GET") {
    return errorResponse(405, "Metodo no permitido.");
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId")?.trim();
  if (!jobId) {
    return errorResponse(400, "jobId es obligatorio.");
  }

  const row = await db
    .from("course_summary_jobs")
    .select(
      "id,status,stage,total_chunks,processed_chunks,percent,attempt_count,preliminary_summary,final_summary,error_message"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (row.error) {
    return errorResponse(500, row.error.message);
  }
  if (!row.data) {
    return errorResponse(404, "No se encontro el job.");
  }

  return jsonResponse(200, {
    success: true,
    jobId: row.data.id,
    status: row.data.status,
    attemptCount: row.data.attempt_count ?? undefined,
    progress: {
      totalChunks: row.data.total_chunks,
      processedChunks: row.data.processed_chunks,
      percent: row.data.percent,
      stage: row.data.stage,
    },
    summary: row.data.final_summary,
    preliminarySummary: row.data.preliminary_summary,
    error: row.data.error_message,
  });
};
