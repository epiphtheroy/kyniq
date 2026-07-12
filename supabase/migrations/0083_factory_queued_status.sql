-- 0083 factory: add 'queued' run status (watcher trigger)
-- The /admin/factory "Run" button and `factory.py queue` mark a run 'queued';
-- worker/factory-watch.sh claims it (queued -> running) and executes the executor.
alter table factory.runs drop constraint if exists runs_status_check;
alter table factory.runs add constraint runs_status_check
  check (status = any (array[
    'planning','awaiting_review','queued','running','paused','done','failed','aborted'
  ]));
