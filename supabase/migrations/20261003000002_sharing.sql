-- Exams shared by link, and the copies people made of them.
create table if not exists exam_shares (
  token text primary key,
  exam_id uuid not null references exams (id) on delete cascade,
  owner_id text not null,
  answers text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists exam_shares_exam on exam_shares (exam_id);
alter table exam_shares enable row level security;

create table if not exists share_copies (
  id bigint generated always as identity primary key,
  token text not null references exam_shares (token) on delete cascade,
  owner_id text not null,
  exam_id uuid not null references exams (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists share_copies_token on share_copies (token, owner_id);
alter table share_copies enable row level security;
