alter table public.articles
  add column if not exists reading_tokens jsonb not null default '[]'::jsonb;
