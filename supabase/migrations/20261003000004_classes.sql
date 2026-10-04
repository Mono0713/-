-- Classes: a teacher's class, who is in it, the exams given to it, and the attempts made on them.
create table if not exists classes (
  id uuid primary key,
  owner_id text not null,
  name text not null,
  join_code text not null unique,
  join_open boolean not null default true,
  ai_payer text not null default 'teacher',
  ai_monthly_cap_usd numeric,
  created_at timestamptz not null default now()
);
create index if not exists classes_owner on classes (owner_id);
alter table classes enable row level security;

create table if not exists class_members (
  class_id uuid not null references classes (id) on delete cascade,
  user_id text not null,
  role text not null,
  name text not null,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index if not exists class_members_user on class_members (user_id);
alter table class_members enable row level security;

-- An assignment keeps its own copy of the questions (sources), so later edits to the exam do not change it.
create table if not exists class_assignments (
  id uuid primary key,
  class_id uuid not null references classes (id) on delete cascade,
  exam_id uuid references exams (id) on delete set null,
  title text not null,
  settings jsonb not null,
  sources jsonb not null,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists class_assignments_class on class_assignments (class_id, created_at);
alter table class_assignments enable row level security;

create table if not exists class_attempts (
  attempt_id uuid primary key references quiz_attempts (id) on delete cascade,
  assignment_id uuid not null references class_assignments (id) on delete cascade,
  user_id text not null,
  preview boolean not null default false,
  started_at timestamptz not null default now()
);
create index if not exists class_attempts_assignment on class_attempts (assignment_id, user_id);
alter table class_attempts enable row level security;

-- AI calls made for a class (marking paid by the teacher) carry its scope, so a monthly cap can be kept.
alter table ai_usage add column if not exists scope text;
create index if not exists ai_usage_scope on ai_usage (owner_id, scope, created_at);
