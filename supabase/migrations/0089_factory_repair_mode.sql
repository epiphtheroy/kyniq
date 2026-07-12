-- factory.py run --adhoc creates mode='repair' runs (target existing films by slug, spanning
-- multiple prior intake runs, for stage-level bug-fix re-application).
alter table factory.runs drop constraint if exists runs_mode_check;
alter table factory.runs add constraint runs_mode_check
  check (mode = any (array['single','bulk','backfill','sentinel','repair']));
