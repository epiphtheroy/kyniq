-- 0062_search_v7_tv_legs.sql — METATAKE TV joins the search engine.
--
-- /tv/[slug] broadcasts (tv_programs, ~1.8k) and /tv/list/[slug] strategic
-- playlists (tv_playlists, ~5.6k) were invisible to search_all. Add two legs:
--
--   kind 'tv'      — one broadcast per film. Matches the program title AND the
--                    film's title/original_title (a film-name query should
--                    surface its broadcast right under the film itself).
--                    Carries the film's poster + year so rows render rich.
--   kind 'tv_list' — playlists. Matches title / dek / axis key. Poster = the
--                    first watchable item's film poster (lateral, matched rows
--                    only). Sub carries axis + size + runtime.
--
-- Weights sit BELOW film/director (0.84 / 0.82): the entity outranks its own
-- broadcast, so a film query reads "the film, then its video" — not a dupe.
-- Sub strings lead with "Watch · " so rows read as video without UI changes.
--
-- Everything else is byte-identical to v6 (0055) + its semantic wrapper.
-- Signature unchanged → drop-then-create (no overload orphaning).

-- tiny tables, but the `%` predicates deserve trgm indexes all the same
create index if not exists idx_tv_programs_title_trgm on public.tv_programs using gin (title gin_trgm_ops);
create index if not exists idx_tv_playlists_title_trgm on public.tv_playlists using gin (title gin_trgm_ops);

drop function if exists public.search_all(text, integer);
create function public.search_all(p_q text, p_limit integer default 60)
returns table(kind text, slug text, film_slug text, title text, sub text, poster text, year integer, score real, is_catalog boolean)
language sql stable security definer
set search_path to 'public', 'curation'
set statement_timeout to '8s'
as $$
with q as (select btrim(p_q) as t, lower(btrim(p_q)) as tl),
kw(kind, w) as (values
  ('film', 1.00::real), ('director', 1.00), ('theorist', 0.95),
  ('trope', 0.92), ('idea', 0.92), ('tradition', 0.92), ('movement', 0.92),
  ('now', 0.90), ('lineage', 0.88), ('archetype', 0.85), ('tv', 0.84),
  ('tv_list', 0.82), ('figure', 0.80), ('reading', 0.78)
)
select d.kind, d.slug, d.film_slug, d.title, d.sub, d.poster, d.year, d.score, d.is_catalog
from (
  select r.*, (r.score * kw.w)::real as wscore,
         row_number() over (partition by r.kind, r.slug, r.film_slug order by r.score * kw.w desc) as rnk
  from (

  select 'film'::text as kind, f.slug, null::text as film_slug, f.title,
         trim(both ' ·' from coalesce(f.year::text,'')
           || case when f.director is not null and f.director <> '' then ' · '||f.director else '' end) as sub,
         f.poster_path as poster, f.year,
         (greatest(
            (lower(f.title) = (select tl from q))::int::real,
            case when lower(f.title) like (select tl from q)||'%' then 0.92 else 0 end,
            case when position((select tl from q) in lower(f.title)) > 0 then 0.72 else 0 end,
            similarity(f.title, (select t from q)),
            word_similarity((select t from q), f.title),
            0.92 * greatest(
              (lower(coalesce(f.original_title,'')) = (select tl from q))::int::real,
              case when lower(coalesce(f.original_title,'')) like (select tl from q)||'%' then 0.9 else 0 end,
              case when position((select tl from q) in lower(coalesce(f.original_title,''))) > 0 then 0.7 else 0 end,
              similarity(coalesce(f.original_title,''), (select t from q))),
            0.62 * word_similarity((select t from q), coalesce(f.director,'')),
            0.97 * coalesce((
              select max(greatest(
                (lower(a.alias) = (select tl from q))::int::real,
                case when lower(a.alias) like (select tl from q)||'%' then 0.9 else 0 end,
                similarity(a.alias, (select t from q))))
              from search_aliases a
              where a.kind = 'film' and a.slug = f.slug
                and (a.alias % (select t from q) or a.alias ilike '%'||(select t from q)||'%')
            ), 0)
          ) * case when f.visible then 1.0 else 0.8 end)::real as score,
         (not f.visible) as is_catalog
  from films f
  where (f.visible or f.slug not like 'tmdb-%')
    and (f.title % (select t from q) or f.title ilike '%'||(select t from q)||'%'
         or coalesce(f.original_title,'') % (select t from q)
         or f.original_title ilike '%'||(select t from q)||'%'
         or f.director % (select t from q)
         or f.director ilike '%'||(select t from q)||'%'
         or exists (select 1 from search_aliases a
                    where a.kind='film' and a.slug=f.slug
                      and (a.alias % (select t from q) or a.alias ilike '%'||(select t from q)||'%')))

  union all
  select 'director', d.slug, null, d.name, coalesce(d.place_of_birth,''), d.profile_path, null,
         greatest(
           (lower(d.name) = (select tl from q))::int::real,
           case when lower(d.name) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(d.name, (select t from q)),
           word_similarity((select t from q), d.name),
           0.97 * coalesce((
             select max(greatest(
               (lower(a.alias) = (select tl from q))::int::real,
               similarity(a.alias, (select t from q))))
             from search_aliases a
             where a.kind = 'director' and a.slug = d.slug
               and (a.alias % (select t from q) or a.alias ilike '%'||(select t from q)||'%')
           ), 0))::real,
         false
  from directors d
  where ((d.name % (select t from q) or d.name ilike '%'||(select t from q)||'%')
         or exists (select 1 from search_aliases a
                    where a.kind='director' and a.slug=d.slug
                      and (a.alias % (select t from q) or a.alias ilike '%'||(select t from q)||'%')))
    and exists (select 1 from films f where f.director_slug = d.slug)

  union all
  select 'trope', m.slug, null, m.title, coalesce(m.laconic,''), null, null,
         greatest(
           (lower(m.title) = (select tl from q))::int::real,
           case when lower(m.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(m.title, (select t from q)),
           word_similarity((select t from q), m.title),
           0.6 * similarity(coalesce(m.laconic,''), (select t from q)))::real,
         false
  from meta_takes m
  where m.status='published' and m.kind='figure_type' and m.slug is not null
    and (m.title % (select t from q) or m.title ilike '%'||(select t from q)||'%'
         or coalesce(m.laconic,'') ilike '%'||(select t from q)||'%')

  union all
  select 'reading', fg.slug, fl.slug, t.take_title, fl.title, fl.poster_path, fl.year,
         greatest(
           (lower(t.take_title) = (select tl from q))::int::real,
           case when lower(t.take_title) like (select tl from q)||'%' then 0.85 else 0 end,
           similarity(t.take_title, (select t from q)))::real,
         false
  from takes t
  join figures fg on fg.id = t.figure_id and fg.status='approved'
  join films fl on fl.id = fg.film_id and fl.visible
  where t.status='published' and t.framework <> 'INVITATION' and t.take_title is not null
    and (t.take_title % (select t from q) or t.take_title ilike '%'||(select t from q)||'%')

  union all
  select 'figure', fg.slug, fl.slug, fg.label, fl.title, fl.poster_path, fl.year,
         greatest(
           (lower(fg.label) = (select tl from q))::int::real,
           case when lower(fg.label) like (select tl from q)||'%' then 0.85 else 0 end,
           similarity(fg.label, (select t from q)))::real,
         false
  from figures fg join films fl on fl.id = fg.film_id
  where fl.visible and fg.slug is not null
    and (fg.label % (select t from q) or fg.label ilike '%'||(select t from q)||'%')

  union all
  select 'theorist', th.slug, null, th.name, coalesce(left(th.blurb, 90),''), null, null,
         (greatest(
           (lower(th.name) = (select tl from q))::int::real,
           case when lower(th.name) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(th.name, (select t from q)),
           word_similarity((select t from q), th.name))
          * case when th.name ~ '[/,&]| and ' then 0.6 else 1.0 end)::real,
         false
  from theorists th
  where th.slug is not null
    and (th.name % (select t from q) or th.name ilike '%'||(select t from q)||'%')

  union all
  select 'idea', c.cslug, null, c.cname, 'concept', null, null,
         greatest(
           (lower(c.cname) = (select tl from q))::int::real,
           case when lower(c.cname) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(c.cname, (select t from q)),
           word_similarity((select t from q), c.cname))::real,
         false
  from (select distinct coalesce(canon_slug, slug) as cslug, coalesce(canon_name, name) as cname
        from sm_concepts where coalesce(canon_slug, slug) is not null) c
  where (c.cname % (select t from q) or c.cname ilike '%'||(select t from q)||'%')

  union all
  select 'tradition', tc.slug, null, tc.title, coalesce(tc.theorist,''), null, null,
         greatest(
           (lower(tc.title) = (select tl from q))::int::real,
           case when lower(tc.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(tc.title, (select t from q)),
           word_similarity((select t from q), tc.title),
           0.7 * word_similarity((select t from q), coalesce(tc.theorist,'')))::real,
         false
  from (select distinct on (slug) slug, title, theorist from theory_canon where slug is not null) tc
  where (tc.title % (select t from q) or tc.title ilike '%'||(select t from q)||'%'
         or coalesce(tc.theorist,'') ilike '%'||(select t from q)||'%')

  union all
  select 'lineage', ll.slug, null, ll.label,
         initcap(coalesce(ll.facet,'list'))||' · '||ll.film_count||' films', null, null,
         greatest(
           (lower(ll.label) = (select tl from q))::int::real,
           case when lower(ll.label) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(ll.label, (select t from q)),
           word_similarity((select t from q), ll.label))::real,
         false
  from lineage_lists ll
  where ll.status = 'active' and ll.film_count > 0 and ll.slug is not null
    and (ll.label % (select t from q) or ll.label ilike '%'||(select t from q)||'%')

  union all
  select 'movement', h.hub_slug, null, h.label,
         case when h.hub_type='movement' then 'movement' else 'national cinema' end
           || coalesce(' · '||nullif(h.region,''),''), null, null,
         greatest(
           (lower(h.label) = (select tl from q))::int::real,
           case when lower(h.label) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(h.label, (select t from q)),
           word_similarity((select t from q), h.label))::real,
         false
  from curation.hub h
  where h.status='live' and h.hub_slug is not null
    and (h.label % (select t from q) or h.label ilike '%'||(select t from q)||'%')

  union all
  select 'archetype', tn.slug, tn.kind, tn.label, 'archetype', null, null,
         greatest(
           (lower(tn.label) = (select tl from q))::int::real,
           case when lower(tn.label) like (select tl from q)||'%' then 0.88 else 0 end,
           similarity(tn.label, (select t from q)),
           word_similarity((select t from q), tn.label))::real,
         false
  from taxonomy_nodes tn
  where tn.status='active' and tn.slug is not null
    and (tn.label % (select t from q) or tn.label ilike '%'||(select t from q)||'%')

  union all
  -- Now Playing news articles (headline / keyword)
  select 'now', na.slug, na.film_slug, na.headline, coalesce(nullif(na.dek,''), na.keyword, 'Now Playing'), null, null,
         greatest(
           (lower(na.headline) = (select tl from q))::int::real,
           case when lower(na.headline) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(na.headline, (select t from q)),
           word_similarity((select t from q), na.headline),
           0.8 * word_similarity((select t from q), coalesce(na.keyword,'')))::real,
         false
  from now_articles na
  where na.status='published' and na.slug is not null
    and (na.headline % (select t from q) or na.headline ilike '%'||(select t from q)||'%'
         or coalesce(na.keyword,'') % (select t from q)
         or coalesce(na.keyword,'') ilike '%'||(select t from q)||'%')

  union all
  -- METATAKE TV broadcasts — one per film; a film-name query surfaces its video
  select 'tv', p.slug, fl.slug, p.title,
         'Watch · '||fl.title
           || coalesce(' ('||fl.year::text||')','')
           || ' · '||p.seg_count||' chapters · '||tv_fmt_dur(p.duration_ms),
         fl.poster_path, fl.year,
         greatest(
           (lower(p.title) = (select tl from q))::int::real,
           case when lower(p.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(p.title, (select t from q)),
           word_similarity((select t from q), p.title),
           0.95 * greatest(
             similarity(fl.title, (select t from q)),
             word_similarity((select t from q), fl.title),
             0.9 * similarity(coalesce(fl.original_title,''), (select t from q))))::real,
         false
  from tv_programs p
  join films fl on fl.id = p.film_id
  where p.status = 'published' and p.slug is not null
    and (p.title % (select t from q) or p.title ilike '%'||(select t from q)||'%'
         or fl.title % (select t from q) or fl.title ilike '%'||(select t from q)||'%'
         or coalesce(fl.original_title,'') % (select t from q))

  union all
  -- METATAKE TV playlists — the strategic axis compilations (/tv/list/[slug])
  select 'tv_list', pl.slug, null, pl.title,
         'Watch · '||initcap(coalesce(nullif(pl.axis,''),'playlist'))
           || case when coalesce(pl.n_films,0) > 0 then ' · '||pl.n_films||' films' else '' end
           || case when coalesce(pl.total_ms,0) > 0 then ' · '||tv_fmt_dur(pl.total_ms) else '' end,
         fp.poster_path, null,
         greatest(
           (lower(pl.title) = (select tl from q))::int::real,
           case when lower(pl.title) like (select tl from q)||'%' then 0.9 else 0 end,
           similarity(pl.title, (select t from q)),
           word_similarity((select t from q), pl.title),
           0.7 * word_similarity((select t from q), coalesce(pl.dek,'')),
           0.85 * word_similarity((select t from q), replace(coalesce(pl.key,''),'-',' ')))::real,
         false
  from tv_playlists pl
  left join lateral (
    select f2.poster_path
    from tv_playlist_items pi
    left join tv_programs pr on pr.id = pi.program_id
    left join tv_segments sg on sg.id = pi.segment_id
    join films f2 on f2.id = coalesce(pr.film_id, sg.film_id)
    where pi.playlist_id = pl.id and f2.poster_path is not null
    order by pi.pos
    limit 1
  ) fp on true
  where pl.slug is not null
    and (coalesce(pl.n_films,0) > 0 or coalesce(pl.n_segments,0) > 0)
    and (pl.title % (select t from q) or pl.title ilike '%'||(select t from q)||'%'
         or coalesce(pl.dek,'') % (select t from q)
         or replace(coalesce(pl.key,''),'-',' ') % (select t from q)
         or replace(coalesce(pl.key,''),'-',' ') ilike '%'||(select t from q)||'%')

  ) r
  join kw on kw.kind = r.kind
  where (select length(t) from q) >= 2 and r.score > 0.12
) d
where d.rnk = 1
order by d.wscore desc, d.is_catalog asc, d.title
limit greatest(1, least(p_limit, 120));
$$;

grant execute on function public.search_all(text, integer) to anon, authenticated, service_role;
