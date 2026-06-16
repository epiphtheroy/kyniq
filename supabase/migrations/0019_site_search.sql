-- 0019 — site search v1 (keyword + fuzzy via Postgres FTS + pg_trgm)
-- Searches the named entities (films, figures, meta-takes, directors) with typo
-- tolerance + prefix/substring. v2 (semantic/hybrid over takes via pgvector) is
-- deferred until take/figure embeddings exist (see figure-page-KEPT.md).

create extension if not exists pg_trgm;

create index if not exists idx_films_title_trgm     on public.films       using gin (title  gin_trgm_ops);
create index if not exists idx_figures_label_trgm   on public.figures     using gin (label  gin_trgm_ops);
create index if not exists idx_meta_takes_title_trgm on public.meta_takes using gin (title  gin_trgm_ops);
create index if not exists idx_meta_takes_lac_trgm  on public.meta_takes  using gin (laconic gin_trgm_ops);
create index if not exists idx_directors_name_trgm  on public.directors   using gin (name   gin_trgm_ops);

create or replace function public.search_site(p_q text, p_limit int default 8)
returns table(kind text, slug text, film_slug text, title text, sub text, score real)
language sql stable security definer set search_path = public as $$
  with q as (select btrim(p_q) as t)
  select * from (
    -- meta takes (title + laconic)
    select 'meta_take'::text as kind, m.slug, null::text as film_slug, m.title, coalesce(m.laconic,'') as sub,
      greatest(
        (lower(m.title) = lower((select t from q)))::int::real,
        case when lower(m.title) like lower((select t from q))||'%' then 0.9 else 0 end,
        similarity(m.title, (select t from q)),
        0.6 * similarity(coalesce(m.laconic,''), (select t from q))
      ) as score
    from meta_takes m
    where m.status='published' and (
      m.title % (select t from q) or m.title ilike '%'||(select t from q)||'%'
      or coalesce(m.laconic,'') ilike '%'||(select t from q)||'%')

    union all
    -- films (title)
    select 'film', f.slug, null, f.title, coalesce(f.year::text,''),
      greatest(
        (lower(f.title) = lower((select t from q)))::int::real,
        case when lower(f.title) like lower((select t from q))||'%' then 0.9 else 0 end,
        similarity(f.title, (select t from q))
      )
    from films f
    where f.title % (select t from q) or f.title ilike '%'||(select t from q)||'%'

    union all
    -- figures (label) — carry the film for the href + context
    select 'figure', fg.slug, fl.slug, fg.label, fl.title,
      greatest(
        case when lower(fg.label) like lower((select t from q))||'%' then 0.85 else 0 end,
        similarity(fg.label, (select t from q))
      )
    from figures fg join films fl on fl.id = fg.film_id
    where fg.label % (select t from q) or fg.label ilike '%'||(select t from q)||'%'

    union all
    -- directors (name)
    select 'director', d.slug, null, d.name, coalesce(d.place_of_birth,''),
      greatest(
        (lower(d.name) = lower((select t from q)))::int::real,
        case when lower(d.name) like lower((select t from q))||'%' then 0.9 else 0 end,
        similarity(d.name, (select t from q))
      )
    from directors d
    where d.name % (select t from q) or d.name ilike '%'||(select t from q)||'%'
  ) r
  where r.score > 0.08
  order by r.score desc, r.title
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.search_site(text,int) from public;
grant execute on function public.search_site(text,int) to anon, authenticated;
