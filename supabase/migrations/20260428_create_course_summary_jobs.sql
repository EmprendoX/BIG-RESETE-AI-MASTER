create extension if not exists pgcrypto;

do $$ begin
  create type course_summary_job_status as enum ('queued', 'processing', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type course_summary_job_stage as enum ('chunk', 'batch', 'final');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.course_summary_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  status course_summary_job_status not null default 'queued',
  stage course_summary_job_stage not null default 'chunk',
  total_chunks integer not null default 0 check (total_chunks >= 0),
  processed_chunks integer not null default 0 check (processed_chunks >= 0),
  percent integer not null default 0 check (percent between 0 and 100),
  request_payload jsonb not null,
  preliminary_summary jsonb null,
  final_summary jsonb null,
  error_message text null,
  idempotency_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz null
);

create table if not exists public.course_summary_job_logs (
  id bigserial primary key,
  job_id uuid not null references public.course_summary_jobs(id) on delete cascade,
  level text not null default 'info',
  event text not null,
  data jsonb null,
  created_at timestamptz not null default now()
);

create unique index if not exists course_summary_jobs_idempotency_key_uq
  on public.course_summary_jobs (idempotency_key)
  where idempotency_key is not null;

create index if not exists course_summary_jobs_status_updated_idx
  on public.course_summary_jobs (status, updated_at desc);

create index if not exists course_summary_jobs_created_idx
  on public.course_summary_jobs (created_at desc);

create index if not exists course_summary_jobs_user_created_idx
  on public.course_summary_jobs (user_id, created_at desc);

create index if not exists course_summary_job_logs_job_created_idx
  on public.course_summary_job_logs (job_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_course_summary_jobs_updated_at on public.course_summary_jobs;

create trigger trg_course_summary_jobs_updated_at
before update on public.course_summary_jobs
for each row execute function public.set_updated_at();
