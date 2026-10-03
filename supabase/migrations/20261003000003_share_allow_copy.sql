-- Whether people with a share link may add a copy of the exam to their own bank.
alter table exam_shares add column if not exists allow_copy boolean not null default true;
