-- Sheetloop schema for hosting on Supabase (Postgres).
-- The web server connects as the database owner and checks ownership itself.
-- Row level security is on with no policies, so the public anon key used for
-- sign-in can never read or change these tables directly.

create table if not exists imports (
  id uuid primary key,
  owner_id text not null,
  file_name text not null,
  page_count integer not null,
  provider text not null,
  model text,
  status text not null,
  progress_done integer not null default 0,
  progress_total integer not null default 0,
  error text,
  title text,
  subject text,
  draft jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists imports_owner on imports (owner_id, created_at);

create table if not exists exams (
  id uuid primary key,
  owner_id text not null,
  import_id uuid references imports (id) on delete set null,
  title text,
  subject text,
  institution text,
  term text,
  language text,
  groups jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exams_owner on exams (owner_id, created_at);
create index if not exists exams_import on exams (import_id);

create table if not exists questions (
  id uuid primary key,
  owner_id text not null,
  exam_id uuid not null references exams (id) on delete cascade,
  position integer not null,
  type text not null,
  search_text text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists questions_owner on questions (owner_id, created_at);
create index if not exists questions_exam on questions (exam_id, position);

create table if not exists quiz_attempts (
  id uuid primary key,
  owner_id text not null,
  data jsonb not null,
  started_at timestamptz not null,
  finished_at timestamptz
);
create index if not exists quiz_attempts_owner on quiz_attempts (owner_id, started_at);

create table if not exists grading_cache (
  key text primary key,
  marking jsonb not null,
  created_at timestamptz not null default now()
);

-- api_keys holds the user's API keys encrypted by the server (AES-256-GCM); settings holds everything else.
create table if not exists user_settings (
  owner_id text primary key,
  settings jsonb not null default '{}',
  api_keys text,
  updated_at timestamptz not null default now()
);

alter table imports enable row level security;
alter table exams enable row level security;
alter table questions enable row level security;
alter table quiz_attempts enable row level security;
alter table grading_cache enable row level security;
alter table user_settings enable row level security;
