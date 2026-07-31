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

create or replace function public.claim_next_job()
returns table (
  id uuid,
  type text,
  telegram_user_id bigint,
  telegram_chat_id bigint,
  telegram_update_id bigint,
  payload jsonb,
  attempts int
)
language plpgsql
as $$
begin
  return query
  with picked as (
    select jobs.id
    from public.jobs
    where jobs.status = 'queued'
      and jobs.available_at <= now()
      and jobs.attempts < jobs.max_attempts
    order by jobs.created_at asc
    for update skip locked
    limit 1
  ),
  updated as (
    update public.jobs
    set
      status = 'processing',
      attempts = public.jobs.attempts + 1,
      locked_at = now(),
      updated_at = now()
    from picked
    where public.jobs.id = picked.id
    returning
      public.jobs.id,
      public.jobs.type,
      public.jobs.telegram_user_id,
      public.jobs.telegram_chat_id,
      public.jobs.telegram_update_id,
      public.jobs.payload,
      public.jobs.attempts
  )
  select
    updated.id,
    updated.type,
    updated.telegram_user_id,
    updated.telegram_chat_id,
    updated.telegram_update_id,
    updated.payload,
    updated.attempts
  from updated;
end;
$$;

create or replace function public.complete_job(job_id uuid)
returns void
language sql
as $$
  update public.jobs
  set
    status = 'done',
    locked_at = null,
    updated_at = now()
  where id = job_id;
$$;

create or replace function public.fail_job(job_id uuid, error_message text)
returns void
language sql
as $$
  update public.jobs
  set
    status = case
      when attempts < max_attempts then 'queued'::public.job_status
      else 'failed'::public.job_status
    end,
    locked_at = null,
    available_at = case
      when attempts < max_attempts then now() + interval '30 seconds'
      else available_at
    end,
    last_error = error_message,
    updated_at = now()
  where id = job_id;
$$;
