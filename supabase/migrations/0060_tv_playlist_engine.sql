-- 0060_tv_playlist_engine.sql — strategic playlists that MIRROR existing axes.
-- No new categories: lineage / director / genre / country / decade / theorist /
-- trope / concept / archetype / genre×topic. Each playlist = an axis-table join
-- to tv_programs/tv_segments. LLM-0 (titles = tv_pick templates × facts).
-- See docs/WORKORDER-tv-strategic-playlists.md. Server-safe: builders take
-- advisory lock 777002 + statement_timeout; large axes are batched (offset).

-- ── 1 · schema (additive; existing rows preserved) ──────────────────────────
alter table public.tv_playlists
  add column if not exists axis        text,
  add column if not exists key         text,
  add column if not exists cut         text not null default 'films',
  add column if not exists intro       jsonb,
  add column if not exists href        text,
  add column if not exists n_films     int,
  add column if not exists n_segments  int,
  add column if not exists total_ms    bigint,
  add column if not exists updated_at  timestamptz default now();
create unique index if not exists tv_playlists_axis_key_cut on public.tv_playlists(axis, key, cut) where axis is not null;
create unique index if not exists tv_playlists_slug_uk on public.tv_playlists(slug);

-- reset the legacy auto playlists (genre + on-location) — the builders recreate
-- genre identically; keep only the curated palme-files (the /tv/watch default).
delete from public.tv_playlist_items where playlist_id in (select id from public.tv_playlists where slug <> 'palme-files');
delete from public.tv_playlists where slug <> 'palme-files';
update public.tv_playlists set axis='manual', key='palme-dor', cut='films', href='/lineage/cannes-palme-dor', updated_at=now() where slug='palme-files';

-- ── 2 · small helpers ───────────────────────────────────────────────────────
create or replace function public.tv_slugify(t text) returns text
language sql immutable as $$
  select regexp_replace(lower(regexp_replace(trim(coalesce(t,'')),'[^a-z0-9]+','-','gi')),'^-+|-+$','','g')
$$;

create or replace function public.tv_fmt_dur(ms bigint) returns text
language sql immutable as $$
  select case
    when ms is null or ms <= 0 then '0m'
    when ms >= 3600000 then (ms/3600000)::text||'h '||((ms%3600000)/60000)::text||'m'
    else greatest(1, ms/60000)::text||'m' end
$$;

-- ── 3 · upsert helpers (build the row, its items, its counts, its intro) ─────
-- films cut: p_film_ids is the ordered film list; items are the top 40 programs.
create or replace function public.tv_upsert_film_playlist(
  p_axis text, p_key text, p_slug text, p_title text, p_dek text, p_href text, p_criteria text, p_film_ids uuid[]
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nf int; v_nseg int; v_ms bigint; v_chips text[]; v_intro jsonb;
begin
  if coalesce(array_length(p_film_ids,1),0) = 0 then return; end if;
  insert into tv_playlists (slug, title, dek, kind, axis, key, cut, href, updated_at)
  values (p_slug, p_title, p_dek, 'films', p_axis, p_key, 'films', p_href, now())
  on conflict (axis, key, cut) where axis is not null
  do update set slug=excluded.slug, title=excluded.title, href=excluded.href, updated_at=now()
  returning id into v_id;

  delete from tv_playlist_items where playlist_id = v_id;
  insert into tv_playlist_items (playlist_id, pos, program_id)
  select v_id, row_number() over (order by fi.ord), p.id
  from unnest(p_film_ids) with ordinality as fi(fid, ord)
  join tv_programs p on p.film_id = fi.fid and p.status='published'
  order by fi.ord limit 40;

  select count(*), coalesce(sum(pr.seg_count),0), coalesce(sum(pr.duration_ms),0)
    into v_nf, v_nseg, v_ms
  from tv_playlist_items i join tv_programs pr on pr.id=i.program_id
  where i.playlist_id=v_id;

  select array_agg(t order by pos) into v_chips from (
    select f.title || case when f.year is not null then ' ('||f.year||')' else '' end t, i.pos
    from tv_playlist_items i join tv_programs pr on pr.id=i.program_id join films f on f.id=pr.film_id
    where i.playlist_id=v_id order by i.pos limit 6) c;

  v_intro := jsonb_build_array(
    jsonb_build_object('zone','top','kicker','A METATAKE TV Watch List','text',p_title,'sub',coalesce(p_criteria,''),'hold',tv_hold(p_title,1700)),
    jsonb_build_object('zone','sub','kicker','In this list',
      'text', v_nf||' films · '||v_nseg||' chapters · '||tv_fmt_dur(v_ms)||' of readings','hold',2800),
    jsonb_build_object('zone','chips','chips', to_jsonb(coalesce(v_chips, array[]::text[])),'hold',3400),
    jsonb_build_object('zone','sub','kicker','How it plays',
      'text','Each film gets its own broadcast; chapters are sampled fresh every visit — leave it on.','hold',2600));

  update tv_playlists set dek=coalesce(p_dek, v_nf||' films'),
    n_films=v_nf, n_segments=v_nseg, total_ms=v_ms, intro=v_intro, updated_at=now()
  where id=v_id;
end $$;

-- segments cut: p_seg_ids is the ordered segment list (one topic slice per film).
create or replace function public.tv_upsert_seg_playlist(
  p_axis text, p_key text, p_slug text, p_title text, p_dek text, p_href text, p_criteria text, p_seg_ids uuid[]
) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_nf int; v_nseg int; v_ms bigint; v_chips text[]; v_intro jsonb;
begin
  if coalesce(array_length(p_seg_ids,1),0) = 0 then return; end if;
  insert into tv_playlists (slug, title, dek, kind, axis, key, cut, href, updated_at)
  values (p_slug, p_title, p_dek, 'segments', p_axis, p_key, 'segments', p_href, now())
  on conflict (axis, key, cut) where axis is not null
  do update set slug=excluded.slug, title=excluded.title, href=excluded.href, updated_at=now()
  returning id into v_id;

  delete from tv_playlist_items where playlist_id = v_id;
  insert into tv_playlist_items (playlist_id, pos, segment_id)
  select v_id, row_number() over (order by si.ord), s.id
  from unnest(p_seg_ids) with ordinality as si(sid, ord)
  join tv_segments s on s.id = si.sid
  order by si.ord limit 60;

  select count(*), count(distinct s.film_id), coalesce(sum(s.duration_ms),0)
    into v_nseg, v_nf, v_ms
  from tv_playlist_items i join tv_segments s on s.id=i.segment_id
  where i.playlist_id=v_id;

  select array_agg(t order by pos) into v_chips from (
    select f.title t, i.pos
    from tv_playlist_items i join tv_segments s on s.id=i.segment_id join films f on f.id=s.film_id
    where i.playlist_id=v_id order by i.pos limit 6) c;

  v_intro := jsonb_build_array(
    jsonb_build_object('zone','top','kicker','A METATAKE TV Topic Cut','text',p_title,'sub',coalesce(p_criteria,''),'hold',tv_hold(p_title,1700)),
    jsonb_build_object('zone','sub','kicker','In this cut',
      'text', v_nseg||' chapters from '||v_nf||' films · '||tv_fmt_dur(v_ms),'hold',2800),
    jsonb_build_object('zone','chips','chips', to_jsonb(coalesce(v_chips, array[]::text[])),'hold',3400),
    jsonb_build_object('zone','sub','kicker','How it plays',
      'text','One chapter per film, back to back — a single theme across the catalogue.','hold',2600));

  update tv_playlists set dek=coalesce(p_dek, v_nseg||' chapters'),
    n_films=v_nf, n_segments=v_nseg, total_ms=v_ms, intro=v_intro, updated_at=now()
  where id=v_id;
end $$;

-- ── 4 · axis builders ───────────────────────────────────────────────────────
create or replace function public.tv_build_lineage_playlists(p_min int default 6, p_facets text[] default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select ll.id, ll.slug, ll.label, ll.facet
    from lineage_lists ll
    join film_lineage fl on fl.list_id = ll.id
    join tv_programs p on p.film_id = fl.film_id and p.status='published'
    where coalesce(ll.status,'active') <> 'merged' and ll.merged_into is null
      and (p_facets is null or ll.facet = any(p_facets))
    group by ll.id, ll.slug, ll.label, ll.facet
    having count(distinct fl.film_id) >= p_min
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select distinct fl.film_id fid, f.year yr, f.title ttl
      from film_lineage fl join films f on f.id=fl.film_id
      join tv_programs p on p.film_id=fl.film_id and p.status='published'
      where fl.list_id = r.id) s;
    v_title := format(tv_pick(
      case when r.facet in ('award','festival') then array['%s: The Complete Files','Every %s Film, Reopened','%s — All the Broadcasts']
           when r.facet = 'movement' then array['%s, As a Broadcast','Inside %s: The Films','%s on METATAKE TV']
           else array['%s: The Watch List','%s, Film by Film','Reading Through %s'] end, 'lin:'||r.slug), r.label);
    perform tv_upsert_film_playlist('lineage', r.slug, 'lineage-'||r.slug, v_title, null,
      case when r.facet='movement' then '/movements/'||r.slug else '/lineage/'||r.slug end,
      'Every '||r.label||' film with a compiled broadcast', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'lineage');
end $$;

create or replace function public.tv_build_director_playlists(p_min int default 3)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select f.director_slug ds, min(f.director) dir
    from films f join tv_programs p on p.film_id=f.id and p.status='published'
    where f.director_slug is not null
    group by f.director_slug having count(*) >= p_min
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select f.id fid, f.year yr, f.title ttl
      from films f join tv_programs p on p.film_id=f.id and p.status='published'
      where f.director_slug = r.ds) s;
    v_title := format(tv_pick(array['%s: The Director''s File','Every %s Film We''ve Read','%s, in Broadcast Order'], 'dir:'||r.ds), r.dir);
    perform tv_upsert_film_playlist('director', r.ds, 'director-'||r.ds, v_title, null,
      '/director/'||r.ds, 'Every '||r.dir||' film with a compiled broadcast, in year order', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'director');
end $$;

create or replace function public.tv_build_genre_playlists(p_min int default 8)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text; v_slug text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select g.genre from (select unnest(f.genres) genre, f.id from films f join tv_programs p on p.film_id=f.id and p.status='published') g
    group by g.genre having count(*) >= p_min
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select f.id fid, f.year yr, f.title ttl
      from films f join tv_programs p on p.film_id=f.id and p.status='published'
      where r.genre = any(f.genres)) s;
    v_slug := 'genre-'||tv_slugify(r.genre);
    v_title := format(tv_pick(array['%s Night on METATAKE TV','%s: The Channel','All Our %s Broadcasts'], 'genre:'||r.genre), r.genre);
    perform tv_upsert_film_playlist('genre', r.genre, v_slug, v_title, null,
      '/genre/'||tv_slugify(r.genre), 'Every '||r.genre||' film with a compiled broadcast', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'genre');
end $$;

create or replace function public.tv_build_country_playlists(p_min int default 8)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select fl.country
    from film_locations fl join tv_programs p on p.film_id=fl.film_id and p.status='published'
    where fl.country is not null and fl.lat is not null
    group by fl.country having count(distinct fl.film_id) >= p_min
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select distinct fl.film_id fid, f.year yr, f.title ttl
      from film_locations fl join films f on f.id=fl.film_id
      join tv_programs p on p.film_id=fl.film_id and p.status='published'
      where fl.country = r.country and fl.lat is not null) s;
    v_title := format(tv_pick(array['Filmed in %s','On Location: %s','%s, On the Record'], 'country:'||r.country), r.country);
    perform tv_upsert_film_playlist('country', tv_slugify(r.country), 'country-'||tv_slugify(r.country), v_title, null,
      null, 'Every broadcast film with a located place in '||r.country, v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'country');
end $$;

create or replace function public.tv_build_decade_playlists(p_min int default 8)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text; v_dec int;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select (f.year/10)*10 dec
    from films f join tv_programs p on p.film_id=f.id and p.status='published'
    where f.year is not null
    group by 1 having count(*) >= p_min
  loop
    v_dec := r.dec;
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select f.id fid, f.year yr, f.title ttl
      from films f join tv_programs p on p.film_id=f.id and p.status='published'
      where (f.year/10)*10 = v_dec) s;
    v_title := format(tv_pick(array['The %ss, Reopened','Cinema of the %ss','%ss: The Broadcast Archive'], 'dec:'||v_dec), v_dec::text);
    perform tv_upsert_film_playlist('decade', v_dec::text, 'decade-'||v_dec||'s', v_title, null,
      null, 'Broadcast films of the '||v_dec||'s', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'decade');
end $$;

create or replace function public.tv_build_theorist_playlists(p_min int default 5, p_top int default 150)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '120s';
  for r in
    select th.slug, min(th.name) nm
    from takes t join figures g on g.id=t.figure_id join theorists th on th.id=t.theorist_id
    join tv_programs p on p.film_id=g.film_id and p.status='published'
    where t.status='published' and t.theorist_id is not null and th.slug is not null
    group by th.slug having count(distinct g.film_id) >= p_min
    order by count(distinct g.film_id) desc limit p_top
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select distinct g.film_id fid, f.year yr, f.title ttl
      from takes t join figures g on g.id=t.figure_id join films f on f.id=g.film_id
      join tv_programs p on p.film_id=g.film_id and p.status='published'
      join theorists th on th.id=t.theorist_id
      where t.status='published' and th.slug = r.slug) s;
    v_title := format(tv_pick(array['Cinema According to %s','%s: The Reading List','Films That Answer to %s'], 'theo:'||r.slug), r.nm);
    perform tv_upsert_film_playlist('theorist', r.slug, 'theorist-'||r.slug, v_title, null,
      '/theorist/'||r.slug, 'Films read through '||r.nm||' on Metatake', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'theorist');
end $$;

-- large axes — BATCHED (offset). runner re-calls until remaining=0.
create or replace function public.tv_build_trope_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_total int; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '150s';
  select count(*) into v_total from (
    select v.trope_id from conn_film_trope_vec v
    join meta_takes mt on mt.id=v.trope_id and mt.kind='figure_type' and mt.status='published'
    join tv_programs p on p.film_id=v.film_id and p.status='published'
    group by v.trope_id having count(distinct v.film_id) >= p_min) s;
  for r in
    select mt.id tid, mt.slug, mt.title
    from conn_film_trope_vec v
    join meta_takes mt on mt.id=v.trope_id and mt.kind='figure_type' and mt.status='published'
    join tv_programs p on p.film_id=v.film_id and p.status='published'
    group by mt.id, mt.slug, mt.title
    having count(distinct v.film_id) >= p_min
    order by count(distinct v.film_id) desc, mt.slug
    offset p_offset limit p_batch
  loop
    select array_agg(fid order by nn desc, yr nulls last) into v_fids from (
      select v.film_id fid, max(v.n) nn, max(f.year) yr
      from conn_film_trope_vec v join films f on f.id=v.film_id
      join tv_programs p on p.film_id=v.film_id and p.status='published'
      where v.trope_id = r.tid group by v.film_id) s;
    v_title := format(tv_pick(array['%s: A Pattern File','The Anatomy of %s','%s, Film After Film'], 'trope:'||r.slug), r.title);
    perform tv_upsert_film_playlist('trope', r.slug, 'trope-'||r.slug, v_title, null,
      '/trope/'||r.slug, 'The films where this pattern recurs', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'trope', 'next_offset', p_offset + p_batch, 'remaining', greatest(0, v_total - (p_offset + p_batch)));
end $$;

create or replace function public.tv_build_concept_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_total int; v_fids uuid[]; v_title text;
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '150s';
  select count(*) into v_total from (
    select tv_slugify(tk.concept) cs
    from takes tk join figures g on g.id=tk.figure_id
    join tv_programs p on p.film_id=g.film_id and p.status='published'
    where tk.status='published' and coalesce(tk.concept,'')<>''
    group by tv_slugify(tk.concept) having count(distinct g.film_id) >= p_min) s;
  for r in
    select tv_slugify(tk.concept) cs, min(trim(tk.concept)) label
    from takes tk join figures g on g.id=tk.figure_id
    join tv_programs p on p.film_id=g.film_id and p.status='published'
    where tk.status='published' and coalesce(tk.concept,'')<>''
    group by tv_slugify(tk.concept) having count(distinct g.film_id) >= p_min
    order by count(distinct g.film_id) desc, tv_slugify(tk.concept)
    offset p_offset limit p_batch
  loop
    if coalesce(r.cs,'') = '' then continue; end if;
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select distinct g.film_id fid, f.year yr, f.title ttl
      from takes tk join figures g on g.id=tk.figure_id join films f on f.id=g.film_id
      join tv_programs p on p.film_id=g.film_id and p.status='published'
      where tk.status='published' and tv_slugify(tk.concept) = r.cs) s;
    v_title := format(tv_pick(array['The Concept File: %s','%s, Across the Films','Thinking With %s'], 'concept:'||r.cs), r.label);
    perform tv_upsert_film_playlist('concept', r.cs, 'concept-'||r.cs, v_title, null,
      '/concept/'||r.cs, 'Films where this concept is at work', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'concept', 'next_offset', p_offset + p_batch, 'remaining', greatest(0, v_total - (p_offset + p_batch)));
end $$;

create or replace function public.tv_build_archetype_playlists(p_min int default 3, p_batch int default 300, p_offset int default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_total int; v_fids uuid[]; v_title text; v_seg text; v_arr text[];
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '150s';
  select count(*) into v_total from (
    select ft.axis, ft.node_id
    from figure_taxonomy ft join figures g on g.id=ft.figure_id
    join tv_programs p on p.film_id=g.film_id and p.status='published'
    where ft.axis in ('object','location','char_archetype','char_identity','char_complex','theme')
    group by ft.axis, ft.node_id having count(distinct g.film_id) >= p_min) s;
  for r in
    select ft.axis, ft.node_id, nn.slug node_slug, min(nn.label) label
    from figure_taxonomy ft join figures g on g.id=ft.figure_id
    join tv_programs p on p.film_id=g.film_id and p.status='published'
    join taxonomy_nodes nn on nn.id=ft.node_id
    where ft.axis in ('object','location','char_archetype','char_identity','char_complex','theme')
    group by ft.axis, ft.node_id, nn.slug
    having count(distinct g.film_id) >= p_min
    order by count(distinct g.film_id) desc, ft.axis, nn.slug
    offset p_offset limit p_batch
  loop
    select array_agg(fid order by yr nulls last, ttl) into v_fids from (
      select distinct g.film_id fid, f.year yr, f.title ttl
      from figure_taxonomy ft join figures g on g.id=ft.figure_id join films f on f.id=g.film_id
      join tv_programs p on p.film_id=g.film_id and p.status='published'
      where ft.axis = r.axis and ft.node_id = r.node_id) s;
    v_seg := case r.axis when 'object' then 'object' when 'location' then 'place'
                 when 'char_identity' then 'identity' when 'char_complex' then 'complex'
                 when 'char_archetype' then 'character' when 'theme' then 'theme' else 'theme' end;
    v_arr := case
      when r.axis in ('char_identity','char_complex','char_archetype') then array['%s: A Recurring Figure','Every %s We''ve Catalogued','%s, Film by Film']
      when r.axis = 'object'   then array['%s: An Object File','The Films That Share %s','%s, Across Cinema']
      when r.axis = 'location' then array['%s: A Place That Recurs','The Films That Share %s','%s, Across Cinema']
      else array['%s: The Theme File','Films Built on %s','%s, Traced Across Cinema'] end;
    v_title := format(tv_pick(v_arr, 'arch:'||r.axis||':'||r.node_slug), r.label);
    perform tv_upsert_film_playlist('archetype', r.axis||':'||r.node_slug,
      'arch-'||replace(r.axis,'_','-')||'-'||r.node_slug, v_title, null,
      '/catalog/'||v_seg||'/'||r.node_slug, 'The films that share this element', v_fids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'archetype', 'next_offset', p_offset + p_batch, 'remaining', greatest(0, v_total - (p_offset + p_batch)));
end $$;

-- genre × topic — segment cut (one topic slice per film). One representative
-- segment per film per topic (lowest seq), capped at 60.
create or replace function public.tv_build_genre_topic_playlists(p_min int default 12)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0; v_sids uuid[]; v_title text; v_label text;
  topics text[] := array['locations','reception','honors','misreading'];
begin
  if not pg_try_advisory_lock(777002) then return jsonb_build_object('locked', true); end if;
  set local statement_timeout = '150s';
  for r in
    select g.genre, t.topic, count(distinct s.film_id) nf
    from unnest(topics) t(topic)
    join tv_segments s on s.topic = t.topic
    join films f on f.id = s.film_id
    join tv_programs p on p.film_id = s.film_id and p.status='published'
    cross join lateral (select unnest(f.genres) genre) g
    group by g.genre, t.topic having count(distinct s.film_id) >= p_min
  loop
    select array_agg(sid order by yr nulls last, ttl) into v_sids from (
      select distinct on (s.film_id) s.id sid, f.year yr, f.title ttl
      from tv_segments s join films f on f.id=s.film_id
      join tv_programs p on p.film_id=s.film_id and p.status='published'
      where s.topic = r.topic and r.genre = any(f.genres)
      order by s.film_id, s.seq) s;
    v_label := case r.topic when 'locations' then 'Where '||r.genre||' Films Were Really Shot'
                 when 'reception' then 'How '||r.genre||' Films Were Received'
                 when 'honors' then 'The Prizes of '||r.genre||' Cinema'
                 else r.genre||' Films, Read Too Closely' end;
    perform tv_upsert_seg_playlist('genre_topic', tv_slugify(r.genre)||':'||r.topic,
      'x-'||tv_slugify(r.genre)||'-'||r.topic, v_label, null,
      '/genre/'||tv_slugify(r.genre),
      'The '||r.topic||' chapter from each '||r.genre||' broadcast', v_sids);
    n := n + 1;
  end loop;
  perform pg_advisory_unlock(777002);
  return jsonb_build_object('built', n, 'axis', 'genre_topic');
end $$;

-- small axes in one call (large axes run via the batch runner)
create or replace function public.tv_build_all_playlists()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; f jsonb; g jsonb;
begin
  a := tv_build_lineage_playlists();  perform pg_sleep(1);
  b := tv_build_director_playlists(); perform pg_sleep(1);
  c := tv_build_genre_playlists();    perform pg_sleep(1);
  d := tv_build_country_playlists();  perform pg_sleep(1);
  e := tv_build_decade_playlists();   perform pg_sleep(1);
  f := tv_build_theorist_playlists(); perform pg_sleep(1);
  g := tv_build_genre_topic_playlists();
  return jsonb_build_object('lineage',a,'director',b,'genre',c,'country',d,'decade',e,'theorist',f,'genre_topic',g);
end $$;

-- ── 5 · directory RPCs (paged — total ~5,500 rows) ──────────────────────────
create or replace function public.tv_directory_summary()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_agg(jsonb_build_object('axis',axis,'n',n) order by n desc)
  from (select coalesce(axis,'manual') axis, count(*) n from tv_playlists group by 1) s
$$;

create or replace function public.tv_directory(p_axis text default null, p_q text default null, p_limit int default 60, p_offset int default 0)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'total', (select count(*) from tv_playlists where (p_axis is null or axis=p_axis) and (p_q is null or title ilike '%'||p_q||'%')),
    'lists', coalesce((select jsonb_agg(x) from (
       select jsonb_build_object('slug',slug,'title',title,'dek',dek,'kind',kind,'axis',axis,'cut',cut,
         'n_films',n_films,'n_segments',n_segments,'total_ms',total_ms,'href',href) x
       from tv_playlists
       where (p_axis is null or axis=p_axis) and (p_q is null or title ilike '%'||p_q||'%')
       order by n_films desc nulls last, title
       limit least(greatest(p_limit,1),120) offset greatest(p_offset,0)) s), '[]'::jsonb))
$$;

-- ── 6 · tv_watch v3 — prepend an intro pseudo-entry; cap the shelf ──────────
create or replace function public.tv_watch(p_list text default null, p_program text default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
with film_j as (
  select p.id pid, p.slug, p.title, p.dek, p.seg_count, p.duration_ms,
    jsonb_build_object(
      'title', f.title, 'year', f.year, 'slug', f.slug, 'director', f.director,
      'director_slug', f.director_slug, 'poster', f.poster_path, 'backdrop', f.backdrop_path,
      'clip', p.meta->'clips'->>0, 'clips', coalesce(p.meta->'clips','[]'::jsonb)) film
  from tv_programs p join films f on f.id = p.film_id
  where p.status = 'published'
)
select case
  when p_program is not null then
    jsonb_build_object('entries', coalesce((select jsonb_agg(jsonb_build_object(
      'slug', fj.slug, 'title', fj.title, 'dek', fj.dek, 'film', fj.film,
      'segments', (select jsonb_agg(jsonb_build_object('id',s.id,'topic',s.topic,'seq',s.seq,'title',s.title,
                     'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms) order by s.seq)
                   from tv_segments s where s.program_id = fj.pid)))
      from film_j fj where fj.slug = p_program), '[]'::jsonb))
  when p_list is not null then
    (select jsonb_build_object(
      'playlist', jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind,
        'axis',pl.axis,'cut',pl.cut,'href',pl.href,'n_films',pl.n_films,'n_segments',pl.n_segments,'total_ms',pl.total_ms),
      'entries', (
        with ents as (
          select coalesce(jsonb_agg(e order by e_pos), '[]'::jsonb) arr from (
            select i.pos e_pos,
              case when i.program_id is not null then
                (select jsonb_build_object('slug',fj.slug,'title',fj.title,'dek',fj.dek,'film',fj.film,
                   'segments', (select jsonb_agg(jsonb_build_object('id',s.id,'topic',s.topic,'seq',s.seq,'title',s.title,
                                  'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms) order by s.seq)
                                from tv_segments s where s.program_id = fj.pid))
                 from film_j fj where fj.pid = i.program_id)
              else
                (select jsonb_build_object('slug','seg-'||s.id,'title',s.title,'dek',null,'film', fj.film,
                   'segments', jsonb_build_array(jsonb_build_object('id',s.id,'topic',s.topic,'seq',1,'title',s.title,
                     'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms)))
                 from tv_segments s join film_j fj on fj.pid = s.program_id where s.id = i.segment_id)
              end e
            from tv_playlist_items i where i.playlist_id = pl.id
            order by i.pos limit 60
          ) q where e is not null
        )
        select case
          when pl.intro is not null and jsonb_typeof(pl.intro)='array' and jsonb_array_length(pl.intro) > 0
               and jsonb_array_length((select arr from ents)) > 0
          then jsonb_build_array(jsonb_build_object(
                 'slug','intro-'||pl.slug, 'title',pl.title, 'dek',pl.dek,
                 'film', (select arr from ents)->0->'film',
                 'segments', jsonb_build_array(jsonb_build_object(
                    'id','intro-'||pl.id::text, 'topic','intro', 'seq',0, 'title',pl.title,
                    'kicker','A METATAKE TV Watch List', 'accent','#C8102E',
                    'beats', pl.intro,
                    'duration_ms', coalesce((select sum((b->>'hold')::int) from jsonb_array_elements(pl.intro) b), 8000)))
               )) || (select arr from ents)
          else (select arr from ents) end))
     from tv_playlists pl where pl.slug = p_list)
  else
    jsonb_build_object(
      'playlists', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind,'axis',pl.axis,'cut',pl.cut,
          'n', coalesce(pl.n_films, (select count(*) from tv_playlist_items i where i.playlist_id=pl.id))) x
        from tv_playlists pl order by pl.n_films desc nulls last limit 36) s), '[]'::jsonb),
      'n_playlists', (select count(*) from tv_playlists),
      'programs', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('slug',fj.slug,'title',fj.title,'dek',fj.dek,
          'seg_count',fj.seg_count,'duration_ms',fj.duration_ms,'film',fj.film) x
        from film_j fj order by fj.title limit 120) s), '[]'::jsonb))
end
$$;
