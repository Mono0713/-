-- Whether an exam's multiple-choice questions earn part of their points when partly right (學測 rule). Set on the exam page.
alter table exams add column if not exists multiple_partial boolean not null default true;
