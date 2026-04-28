import type { Context } from "@netlify/functions";
import { buildCourseChunks } from "./_lib/courseFiles";
import { getModel, getOpenAI } from "./_lib/openai";
import { db } from "./_lib/supabaseAdmin";
import {
  summarizeBatch,
  summarizeChunk,
  summarizeFinal,
  type ChunkSummary,
} from "./_lib/summaryPipeline";
import type { CreateSummaryJobBody } from "./_lib/courseSummaryJobs";

const BATCH_SIZE = 10;
const MAX_CHUNKS_PER_SLICE = 2;
const MAX_BATCHES_PER_SLICE = 1;
const WORKER_BUDGET_MS = 23_000;
const LOCK_WINDOW_MS = 30_000;
const MAX_ATTEMPTS = 12;

type SummaryCheckpoint = {
  version: 1;
  stage: "chunk" | "batch" | "final";
  nextChunkIndex: number;
  nextBatchIndex: number;
  chunkSummaries: ChunkSummary[];
  batchSummaries: Awaited<ReturnType<typeof summarizeBatch>>[];
  chunksBuilt: boolean;
};

type JobRow = {
  id: string;
  status: string;
  stage: "chunk" | "batch" | "final";
  request_payload: CreateSummaryJobBody;
  checkpoint: SummaryCheckpoint | null;
  attempt_count: number;
  total_chunks: number;
  updated_at: string;
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (req.headers.get("x-internal-token") !== process.env.INTERNAL_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = (await req.json()) as { jobId?: string };
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const jobId = body.jobId?.trim();
  if (!jobId) {
    return new Response("Bad request", { status: 400 });
  }

  const claimed = await claimJob(jobId);
  if (!claimed) {
    return new Response("Job locked or unavailable", { status: 200 });
  }
  if (claimed.status === "ready" || claimed.status === "failed") {
    await releaseLock(claimed.id);
    return new Response("Job already completed", { status: 200 });
  }
  const payload = claimed.request_payload;
  if (!payload) {
    await markFailed(claimed.id, "Payload de job invalido.");
    return new Response("Invalid payload", { status: 500 });
  }

  const openai = getOpenAI();
  const model = getModel();
  const startedAt = Date.now();
  let checkpoint = normalizeCheckpoint(claimed.checkpoint, claimed.stage);
  let chunks: ReturnType<typeof buildCourseChunks> | undefined;

  try {
    await updateJob(claimed.id, {
      status: "processing",
      stage: checkpoint.stage,
      last_heartbeat_at: new Date().toISOString(),
    });
    await insertLog(claimed.id, "info", "job_slice_started", {
      stage: checkpoint.stage,
      nextChunkIndex: checkpoint.nextChunkIndex,
      nextBatchIndex: checkpoint.nextBatchIndex,
      attemptCount: claimed.attempt_count,
    });

    if (!checkpoint.chunksBuilt) {
      chunks = buildCourseChunks(
        payload.fileNames ?? [],
        payload.extractedTexts ?? [],
        payload.chunking ?? { chunkSize: 3000, overlap: 400 }
      );
      checkpoint.chunksBuilt = true;
      await updateJob(claimed.id, {
        total_chunks: chunks.length,
        processed_chunks: checkpoint.nextChunkIndex,
        percent: chunks.length === 0 ? 70 : 0,
        stage: "chunk",
        checkpoint,
        last_heartbeat_at: new Date().toISOString(),
      });
      await insertLog(claimed.id, "info", "chunks_built", { totalChunks: chunks.length });
      if (chunks.length === 0) {
        checkpoint.stage = "batch";
      }
    }

    if (!chunks) {
      chunks = buildCourseChunks(
        payload.fileNames ?? [],
        payload.extractedTexts ?? [],
        payload.chunking ?? { chunkSize: 3000, overlap: 400 }
      );
    }

    if (checkpoint.stage === "chunk") {
      let processedInSlice = 0;
      while (
        checkpoint.nextChunkIndex < chunks.length &&
        processedInSlice < MAX_CHUNKS_PER_SLICE &&
        Date.now() - startedAt < WORKER_BUDGET_MS
      ) {
        const chunk = chunks[checkpoint.nextChunkIndex];
        const chunkSummary = await summarizeChunk({ openai, model, chunk });
        checkpoint.chunkSummaries.push(chunkSummary);
        checkpoint.nextChunkIndex += 1;
        processedInSlice += 1;

        await updateJob(claimed.id, {
          stage: "chunk",
          processed_chunks: checkpoint.nextChunkIndex,
          percent: Math.round((checkpoint.nextChunkIndex / Math.max(chunks.length, 1)) * 70),
          checkpoint,
          last_heartbeat_at: new Date().toISOString(),
        });
        await insertLog(claimed.id, "info", "chunk_processed", {
          chunkIndex: checkpoint.nextChunkIndex - 1,
          totalChunks: chunks.length,
          processedInSlice,
        });
      }
      if (checkpoint.nextChunkIndex >= chunks.length) {
        checkpoint.stage = "batch";
        checkpoint.nextBatchIndex = 0;
        await updateJob(claimed.id, { stage: "batch", percent: Math.max(70, claimed.total_chunks === 0 ? 70 : 0), checkpoint });
      }
    }

    if (checkpoint.stage === "batch" && Date.now() - startedAt < WORKER_BUDGET_MS) {
      const totalBatches = Math.ceil(checkpoint.chunkSummaries.length / BATCH_SIZE);
      let processedBatches = 0;
      while (
        checkpoint.nextBatchIndex < totalBatches &&
        processedBatches < MAX_BATCHES_PER_SLICE &&
        Date.now() - startedAt < WORKER_BUDGET_MS
      ) {
        const start = checkpoint.nextBatchIndex * BATCH_SIZE;
        const batch = checkpoint.chunkSummaries.slice(start, start + BATCH_SIZE);
        const batchSummary = await summarizeBatch({ openai, model, batch });
        checkpoint.batchSummaries.push(batchSummary);
        checkpoint.nextBatchIndex += 1;
        processedBatches += 1;

        const percent = 70 + Math.round((checkpoint.nextBatchIndex / Math.max(totalBatches, 1)) * 20);
        await updateJob(claimed.id, {
          stage: "batch",
          percent,
          checkpoint,
          last_heartbeat_at: new Date().toISOString(),
        });
        await insertLog(claimed.id, "info", "batch_processed", {
          nextBatchIndex: checkpoint.nextBatchIndex,
          totalBatches,
        });
      }
      if (checkpoint.nextBatchIndex >= totalBatches) {
        checkpoint.stage = "final";
        await updateJob(claimed.id, { stage: "final", percent: 95, checkpoint });
      }
    }

    if (checkpoint.stage === "final" && Date.now() - startedAt < WORKER_BUDGET_MS) {
      const finalSummary = await summarizeFinal({
        openai,
        model,
        payload,
        batchSummaries: checkpoint.batchSummaries,
      });
      await updateJob(claimed.id, {
        status: "ready",
        stage: "final",
        percent: 100,
        final_summary: finalSummary,
        error_message: null,
        checkpoint,
        finished_at: new Date().toISOString(),
        locked_until: null,
        last_heartbeat_at: new Date().toISOString(),
      });
      await insertLog(claimed.id, "info", "job_ready", {
        elapsedMs: Date.now() - startedAt,
      });
      return new Response("ok", { status: 200 });
    }

    // Not finished in this slice: persist and dispatch next slice.
    await updateJob(claimed.id, {
      checkpoint,
      locked_until: null,
      last_heartbeat_at: new Date().toISOString(),
    });
    await dispatchNextSlice(req, claimed.id);
    return new Response("accepted", { status: 202 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const attempts = claimed.attempt_count;
    const patch: Record<string, unknown> = {
      attempt_count: attempts,
      checkpoint,
      last_heartbeat_at: new Date().toISOString(),
      locked_until: null,
    };
    if (attempts >= MAX_ATTEMPTS) {
      patch.status = "failed";
      patch.error_message = message;
      patch.finished_at = new Date().toISOString();
      await updateJob(claimed.id, patch);
      await insertLog(claimed.id, "error", "job_failed_terminal", {
        message,
        attempts,
      });
      return new Response("failed", { status: 500 });
    }
    await updateJob(claimed.id, patch);
    await insertLog(claimed.id, "warn", "job_failed_retrying", {
      message,
      attempts,
    });
    await dispatchNextSlice(req, claimed.id);
    return new Response("retrying", { status: 202 });
  }
};

async function dispatchNextSlice(req: Request, jobId: string): Promise<void> {
  const internalToken = process.env.INTERNAL_TOKEN;
  if (!internalToken) return;
  await fetch(`${new URL(req.url).origin}/.netlify/functions/process-course-summary-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken,
    },
    body: JSON.stringify({ jobId }),
  });
}

function normalizeCheckpoint(
  checkpoint: SummaryCheckpoint | null,
  stage: "chunk" | "batch" | "final"
): SummaryCheckpoint {
  if (checkpoint && checkpoint.version === 1) {
    return {
      ...checkpoint,
      stage: checkpoint.stage || stage,
      nextChunkIndex: checkpoint.nextChunkIndex ?? 0,
      nextBatchIndex: checkpoint.nextBatchIndex ?? 0,
      chunkSummaries: checkpoint.chunkSummaries ?? [],
      batchSummaries: checkpoint.batchSummaries ?? [],
      chunksBuilt: checkpoint.chunksBuilt ?? false,
    };
  }
  return {
    version: 1,
    stage,
    nextChunkIndex: 0,
    nextBatchIndex: 0,
    chunkSummaries: [],
    batchSummaries: [],
    chunksBuilt: false,
  };
}

async function claimJob(jobId: string): Promise<JobRow | null> {
  const read = await db
    .from("course_summary_jobs")
    .select("id,status,stage,request_payload,checkpoint,attempt_count,total_chunks,locked_until,updated_at")
    .eq("id", jobId)
    .maybeSingle();
  if (read.error || !read.data) {
    return null;
  }
  const row = read.data as JobRow & { locked_until?: string | null };
  const now = Date.now();
  if (row.locked_until && new Date(row.locked_until).getTime() > now) {
    return null;
  }
  const lockUntil = new Date(now + LOCK_WINDOW_MS).toISOString();
  const claim = await db
    .from("course_summary_jobs")
    .update({
      locked_until: lockUntil,
      last_heartbeat_at: new Date().toISOString(),
      attempt_count: row.attempt_count + 1,
    })
    .eq("id", row.id)
    .eq("updated_at", row.updated_at)
    .select("id,status,stage,request_payload,checkpoint,attempt_count,total_chunks,updated_at")
    .maybeSingle();
  if (claim.error || !claim.data) {
    return null;
  }
  return claim.data as JobRow;
}

async function releaseLock(jobId: string): Promise<void> {
  await updateJob(jobId, { locked_until: null, last_heartbeat_at: new Date().toISOString() });
}

async function markFailed(jobId: string, message: string): Promise<void> {
  await updateJob(jobId, {
    status: "failed",
    error_message: message,
    finished_at: new Date().toISOString(),
    locked_until: null,
    last_heartbeat_at: new Date().toISOString(),
  });
}

async function updateJob(
  jobId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from("course_summary_jobs").update(patch).eq("id", jobId);
  if (error) {
    throw new Error(error.message);
  }
}

async function insertLog(
  jobId: string,
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await db.from("course_summary_job_logs").insert({
    job_id: jobId,
    level,
    event,
    data,
  });
  if (error) {
    console.error("insertLog error", error.message);
  }
}
