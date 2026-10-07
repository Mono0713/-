-- Where a person placed an exam in their bank by dragging; null until they do (those show first, newest first).
alter table exams add column if not exists position integer;
