-- Translated questions, shared across users: the key is a hash of the question text, the reader's language and the way it was translated.
create table if not exists translation_cache (
  key text primary key,
  translation jsonb not null,
  created_at timestamptz not null default now()
);

alter table translation_cache enable row level security;
