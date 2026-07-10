-- 0057 — essay_plain: precomputed plain-text bodies for search snippets (KWIC).
-- ISOLATED: a new table only — nothing existing is touched. Search fetches these
-- small pre-stripped rows instead of live body_md + markdown stripping (the
-- biggest cold-query cost on /search). distinct on (film,desk) keeps the latest
-- verified EN essay. Re-run the INSERT if essays ever change (generation frozen).
-- Applied live 2026-07-10 (mcp apply_migration essay_plain_excerpt_table).
create table if not exists public.essay_plain (
  film_slug text not null,
  desk_key text not null,
  plain text not null,
  primary key (film_slug, desk_key)
);
alter table public.essay_plain enable row level security;
drop policy if exists "essay_plain readable" on public.essay_plain;
create policy "essay_plain readable" on public.essay_plain for select using (true);

insert into public.essay_plain (film_slug, desk_key, plain)
select distinct on (f.slug, dk) f.slug, dk,
  left(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    e.body_md,
    '\[([^\]]*)\]\([^)]*\)', '\1', 'g'),
    '[#>*_`~]+', '', 'g'),
    E'\n{2,}', ' — ', 'g'),
    E'[\n\r]+', ' ', 'g'), 6000)
from essays e
join films f on f.id = e.film_id
cross join lateral (select case e.mode when 'fan_theories' then 'theories' when 'concept_briefing' then 'decoder'
    when 'meta_critique' then 'debates' when 'radical_critique' then 'contested'
    when 'reception_meta' then 'reception-story' when 'juxtaposition' then 'parallel-lives'
    when 'the_lens' then 'field-test' else 'exegesis' end as dk) k
where e.status = 'verified' and e.lang = 'en' and e.body_md is not null
order by f.slug, dk, e.published_at desc nulls last
on conflict (film_slug, desk_key) do update set plain = excluded.plain;
