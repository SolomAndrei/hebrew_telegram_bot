create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null,
  source_url text,
  original_text text not null,
  original_summary text not null,
  adapted_title text not null,
  adapted_text text not null,
  difficulty_score int not null,
  is_validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_user_created_at_idx
  on public.articles (user_id, created_at);

drop trigger if exists set_articles_updated_at on public.articles;

create trigger set_articles_updated_at
before update on public.articles
for each row
execute function public.set_updated_at();
