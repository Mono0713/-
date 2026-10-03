-- Uploaded files are deleted 30 days after an import is saved to the bank,
-- unless the owner keeps them; page images stay either way.
alter table imports add column if not exists keep_original boolean not null default false;
alter table imports add column if not exists original_deleted_at timestamptz;
