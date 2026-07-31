create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create type public.user_word_status as enum ('learning', 'mastered');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  current_level_score int not null default 300,
  generated_words_without_translation int not null default 0,
  last_level_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_telegram_id_idx
  on public.users (telegram_id);

drop trigger if exists set_users_updated_at on public.users;

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create table if not exists public.user_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  lemma text not null,
  original_word text,
  part_of_speech text,
  status public.user_word_status not null default 'learning',
  successful_exposures int not null default 0,
  translation_requests int not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lemma)
);

create index if not exists user_words_user_status_idx
  on public.user_words (user_id, status);

drop trigger if exists set_user_words_updated_at on public.user_words;

create trigger set_user_words_updated_at
before update on public.user_words
for each row
execute function public.set_updated_at();

create table if not exists public.reading_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  article_id uuid,
  generated_words_count int not null default 0,
  translation_requests_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists reading_stats_user_created_at_idx
  on public.reading_stats (user_id, created_at);
