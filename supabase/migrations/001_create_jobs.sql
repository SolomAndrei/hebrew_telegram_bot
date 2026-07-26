do $$
begin
  create type public.job_status as enum ('queued', 'processing', 'done', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status public.job_status not null default 'queued',
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  telegram_update_id bigint not null unique,
  payload jsonb not null,
  attempts int not null default 0,
  max_attempts int not null default 3,
  locked_at timestamptz,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_available_at_idx
  on public.jobs (status, available_at);

create index if not exists jobs_telegram_user_id_created_at_idx
  on public.jobs (telegram_user_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jobs_updated_at on public.jobs;

create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();
