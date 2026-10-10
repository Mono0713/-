-- Short notes a teacher posts to a class, shown on its page.
create table if not exists class_announcements (
  id uuid primary key,
  class_id uuid not null references classes (id) on delete cascade,
  author_id text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists class_announcements_class on class_announcements (class_id, created_at);
alter table class_announcements enable row level security;
