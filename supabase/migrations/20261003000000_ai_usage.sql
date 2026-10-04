-- One row per AI call: which task, provider and model, and how many tokens.
-- The settings page sums it into spend per task; class limits and teacher charts will use it too.
create table ai_usage (
  id bigint generated always as identity primary key,
  owner_id text not null,
  task text not null,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  units integer not null default 1,
  created_at timestamptz not null default now()
);
create index ai_usage_owner_created on ai_usage (owner_id, created_at);

alter table ai_usage enable row level security;
