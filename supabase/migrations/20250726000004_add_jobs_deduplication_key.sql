alter table public.jobs
  alter column telegram_update_id drop not null;

alter table public.jobs
  add column if not exists deduplication_key text;

create unique index if not exists jobs_deduplication_key_idx
  on public.jobs (deduplication_key)
  where deduplication_key is not null;
