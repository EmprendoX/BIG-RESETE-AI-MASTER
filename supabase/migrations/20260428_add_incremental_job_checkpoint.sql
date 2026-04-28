alter table public.course_summary_jobs
  add column if not exists checkpoint jsonb not null default '{}'::jsonb;

alter table public.course_summary_jobs
  add column if not exists attempt_count integer not null default 0;

alter table public.course_summary_jobs
  add column if not exists last_heartbeat_at timestamptz null;

alter table public.course_summary_jobs
  add column if not exists locked_until timestamptz null;

create index if not exists course_summary_jobs_status_stage_lock_idx
  on public.course_summary_jobs (status, stage, locked_until);
