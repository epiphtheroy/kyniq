-- 0017 — community takes publish immediately (no pre-review)
-- Decision: human contributions go live on submit, consistent with the AI
-- "publish, then audit" principle. Still login-gated and author-owned.
-- (Admins can later hide/reject via status; the in_review value stays allowed
--  so a moderation queue can be reintroduced without another migration.)

drop policy if exists "takes: insert own" on public.takes;
create policy "takes: insert own" on public.takes for insert
  with check (
    author_id = auth.uid()
    and source = 'human'
    and status in ('published','in_review')
  );
