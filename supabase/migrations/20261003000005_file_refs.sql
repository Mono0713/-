-- Each distinct file is stored once (blobs/<sha256>); file_refs says which blob each key points at.
create table if not exists file_refs (
  key text primary key,
  blob text not null,
  size bigint not null,
  owner text,
  created_at timestamptz not null default now()
);
create index if not exists file_refs_blob on file_refs (blob);
create index if not exists file_refs_owner on file_refs (owner);
alter table file_refs enable row level security;

-- Page images of new imports are stored as compressed WebP (about a tenth of a PNG).
alter table imports add column if not exists page_format text not null default 'png';
