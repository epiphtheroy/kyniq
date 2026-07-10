-- 0056_tv_engine.sql
-- METATAKE TV production engine — compiles a per-film "program" (a broadcast the
-- TVProgramPlayer renders over the film's trailer loop) out of the corpus, with
-- ZERO LLM calls: every headline is template × DB-fact (ScreenRant-style
-- curiosity gap), every beat is precomputed jsonb the player consumes as-is.
--
-- The atomic unit is the SEGMENT (film × topic × seq). Programs are per-film
-- bundles of segments; playlists bundle either whole programs ('films') or
-- topic-sliced segments across films ('segments') — the latter is what makes
-- future cuts like "action-film locations" a WHERE clause, not a rebuild.
-- Players may RANDOM-SAMPLE segments within a film (modules stay built; the
-- broadcast stays short).

-- ── tables ────────────────────────────────────────────────────────────────
create table if not exists public.tv_programs (
  id          uuid primary key default gen_random_uuid(),
  film_id     uuid not null unique references public.films(id) on delete cascade,
  slug        text not null unique,
  title       text not null,
  dek         text,
  seg_count   int  not null default 0,
  duration_ms int  not null default 0,
  status      text not null default 'published',
  built_at    timestamptz not null default now(),
  meta        jsonb
);

create table if not exists public.tv_segments (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.tv_programs(id) on delete cascade,
  film_id     uuid not null references public.films(id) on delete cascade,
  topic       text not null,   -- open|misreading|figures|ideas|reception|honors|canon|locations|map|kindred|close
  seq         int  not null,
  title       text not null,   -- curiosity headline (template × fact)
  kicker      text,
  accent      text,
  beats       jsonb not null,  -- the player's Beat[] — zone/kicker/text/sub/won/chips/mapApi/mapFull/hold
  duration_ms int  not null,
  meta        jsonb,
  unique (program_id, seq)
);
create index if not exists tv_segments_film_topic on public.tv_segments (film_id, topic);
create index if not exists tv_segments_topic on public.tv_segments (topic);

create table if not exists public.tv_playlists (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  dek        text,
  kind       text not null check (kind in ('films','segments')),
  rule       jsonb,            -- provenance of the cut, e.g. {"genre":"Thriller"} or {"topic":"locations"}
  created_at timestamptz not null default now()
);

create table if not exists public.tv_playlist_items (
  playlist_id uuid not null references public.tv_playlists(id) on delete cascade,
  pos         int  not null,
  program_id  uuid references public.tv_programs(id) on delete cascade,
  segment_id  uuid references public.tv_segments(id) on delete cascade,
  primary key (playlist_id, pos)
);

-- ── helpers ───────────────────────────────────────────────────────────────
-- prose → subtitle-sized chunks (1–2 sentences, ≤ maxlen chars)
create or replace function public.tv_chunks(p text, maxlen int default 150)
returns text[] language plpgsql immutable as $$
declare s text; cur text := ''; out text[] := '{}';
begin
  if p is null or btrim(p) = '' then return out; end if;
  for s in select (regexp_matches(p, '[^.!?]+[.!?…]+["”'')\]]?\s*', 'g'))[1] loop
    if cur <> '' and length(cur || s) > maxlen then out := out || btrim(cur); cur := s;
    else cur := cur || s; end if;
  end loop;
  if btrim(coalesce(cur,'')) <> '' then out := out || btrim(cur); end if;
  if coalesce(array_length(out,1),0) = 0 then out := array[btrim(p)]; end if;
  return out;
end $$;

-- reading-time hold (same curve as the player)
create or replace function public.tv_hold(t text, extra int default 0)
returns int language sql immutable as
$$ select least(12000, greatest(5200, 3400 + coalesce(length(t),0)*42)) + extra $$;

-- deterministic template pick (stable per film × topic — rebuilds don't churn copy)
create or replace function public.tv_pick(arr text[], seed text)
returns text language sql immutable as
$$ select arr[1 + abs(hashtext(seed)) % array_length(arr,1)] $$;

-- ── the compiler ──────────────────────────────────────────────────────────
create or replace function public.tv_compile_film(p_film uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  f record; prog_id uuid; n int := 0; total int := 0;
  clips text[]; beats jsonb; d int; t text; k text; arr text[];
  prog_title text; prog_dek text; rec record; body_chunks text[]; c text;
begin
  select * into f from films where id = p_film;
  if f.id is null then return jsonb_build_object('error','no film'); end if;

  -- trailer-ish clips only; never explainer/featurette content
  select coalesce(array_agg(md.external_id order by (md.title !~* 'trailer'), md.position nulls last), '{}')
    into clips
  from media md
  where md.entity_type='film' and md.entity_id=f.id and md.kind='video'
    and md.title ~* 'trailer|teaser'
    and md.title !~* 'explain|featurette|behind the scenes|interview|review|breakdown|react|making of|commentary';

  delete from tv_programs where film_id = f.id;

  prog_title := format(tv_pick(array[
    '%s: The Critical File',
    'Everything %s Is Hiding in Plain Sight',
    '%s, Reopened',
    'What Everyone Missed in %s',
    '%s: The Dossier'], f.slug || ':prog'), f.title);

  insert into tv_programs (film_id, slug, title, meta)
  values (f.id, f.slug, prog_title, jsonb_build_object('clips', to_jsonb(clips)))
  returning id into prog_id;

  -- 1 · OPEN
  n := n + 1;
  d := tv_hold(prog_title, 1600);
  beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Now on METATAKE TV','text',prog_title,
    'sub', format('%s (%s) · dir. %s', f.title, f.year, coalesce(f.director,'—')), 'hold', d));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'open', n, prog_title, 'Now on METATAKE TV', '#C8102E', beats, d);
  total := total + d;

  -- 2 · MISREADING — one module PER take (top 3 by strength) so random play varies
  for rec in
    select tk.take_title, tk.rationale, tk.leap, tk.framework, tk.theorist_name
    from takes tk join figures g on g.id = tk.figure_id
    where g.film_id = f.id and tk.status='published' and tk.take_title is not null
    order by tk.strength desc nulls last limit 3
  loop
    n := n + 1; d := 0;
    k := 'Strong Misreading' || coalesce(' · '||rec.framework,'') || coalesce(' · after '||rec.theorist_name,'');
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker',k,'text',rec.take_title,'hold',tv_hold(rec.take_title,1400)));
    d := tv_hold(rec.take_title, 1400);
    body_chunks := tv_chunks(rec.rationale);
    for i in 1..least(coalesce(array_length(body_chunks,1),0), 4) loop
      c := body_chunks[i];
      beats := beats || jsonb_build_object('zone','sub','text',c,'hold',tv_hold(c));
      d := d + tv_hold(c);
    end loop;
    if rec.leap is not null then
      beats := beats || jsonb_build_object('zone','sub','kicker','The leap','text',rec.leap,'hold',tv_hold(rec.leap,800));
      d := d + tv_hold(rec.leap, 800);
    end if;
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'misreading', n, rec.take_title, k, '#E3120B', beats, d);
    total := total + d;
  end loop;

  -- 3 · FIGURES (chip cloud, all at once)
  select array_agg(g.label order by (g.description is null), g.label) into arr
  from (select distinct on (label) label, description from figures
        where film_id=f.id and status='approved' and label is not null
          and label not ilike 'the film as a whole' limit 14) g;
  if coalesce(array_length(arr,1),0) >= 4 then
    n := n + 1;
    t := format(tv_pick(array['Every Figure %s Turns On','The Figures That Run %s','%s, Cast as Forces'], f.slug||':fig'), f.title);
    d := tv_hold(t) + 9000;
    beats := jsonb_build_array(
      jsonb_build_object('zone','top','kicker','The figures','text',t,'hold',tv_hold(t)),
      jsonb_build_object('zone','chips','chips',to_jsonb(arr),'hold',9000));
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'figures', n, t, 'The figures', '#C8A2E0', beats, d);
    total := total + d;
  end if;

  -- 4 · IDEAS (concept chip cloud)
  select array_agg(x.nm) into arr from (
    select distinct coalesce(c.canon_name, c.name) nm
    from takes tk join figures g on g.id = tk.figure_id
    join sm_concepts c on exists (select 1 from concept_map k9 where k9.raw_l = lower(btrim(tk.concept)) and k9.concept_id = c.id)
    where g.film_id = f.id and tk.concept is not null and tk.status='published' limit 14) x;
  if coalesce(array_length(arr,1),0) >= 4 then
    n := n + 1;
    t := format(tv_pick(array['The Ideas Hiding Inside %s','%s Thinks in These Concepts','What %s Is Really About — in Concepts'], f.slug||':idea'), f.title);
    d := tv_hold(t) + 9000;
    beats := jsonb_build_array(
      jsonb_build_object('zone','top','kicker','The ideas','text',t,'hold',tv_hold(t)),
      jsonb_build_object('zone','chips','chips',to_jsonb(arr),'hold',9000));
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'ideas', n, t, 'The ideas', '#D9C08A', beats, d);
    total := total + d;
  end if;

  -- 5 · RECEPTION (quotes)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select rc.dek_lead, btrim(rc.outlet || coalesce(' · '||nullif(btrim(rc.critic),''),'')) src, rc.review_year
    from film_reception rc where rc.film_id=f.id and rc.dek_lead is not null
    order by random() limit 3
  loop
    beats := beats || jsonb_build_object('zone','quote','text',rec.dek_lead,
      'sub', rec.src || coalesce(' · '||rec.review_year::text,''), 'hold', tv_hold(rec.dek_lead,1000));
    d := d + tv_hold(rec.dek_lead, 1000);
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['What Critics Really Said About %s','The Reviews %s Actually Got','When Critics Met %s'], f.slug||':rec'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','What critics said','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'reception', n, t, 'What critics said', '#F2A9B4', beats, d);
    total := total + d;
  end if;

  -- 6 · HONORS (wins/nominations stack)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select l.list_label || coalesce(' ('||l.edition_year||')','') txt,
           initcap(coalesce(l.result,'listed')) res,
           (coalesce(l.result,'') ~* 'won|win') won
    from film_lineage_for(f.id) l
    where coalesce(l.result,'') ~* 'won|win|nominat'
    order by (coalesce(l.result,'') !~* 'won|win'), l.edition_year desc nulls last limit 6
  loop
    beats := beats || jsonb_build_object('zone','stack','text',rec.txt,'sub',rec.res,'won',rec.won,'hold',3300);
    d := d + 3300;
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['The Record %s Holds','Why Juries Kept Rewarding %s','%s: The Trophy Shelf'], f.slug||':hon'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','The record','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'honors', n, t, 'The record', '#E0A93E', beats, d);
    total := total + d;
  end if;

  -- 7 · CANON (ranked lists)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select l.list_label txt, '#'||l.rank || coalesce(' · '||l.edition_year,'') res
    from film_lineage_for(f.id) l where l.rank is not null
    order by l.rank asc limit 6
  loop
    beats := beats || jsonb_build_object('zone','stack','text',rec.txt,'sub',rec.res,'won',true,'hold',3300);
    d := d + 3300;
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['Why %s Keeps Entering the Canon','Where %s Ranks — According to History','%s in the All-Time Lists'], f.slug||':can'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','In the canon','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'canon', n, t, 'In the canon', '#E0A93E', beats, d);
    total := total + d;
  end if;

  -- 8 · LOCATIONS (the atlas)
  if exists (select 1 from film_locations l where l.film_id=f.id and l.name is not null and l.lat is not null) then
    n := n + 1;
    t := format(tv_pick(array['Where %s Was Really Shot','You Can Stand Where %s Happened','The Real Places Behind %s'], f.slug||':loc'), f.title);
    d := tv_hold(t, 800) + 17000;
    beats := jsonb_build_array(
      jsonb_build_object('zone','top','kicker','On location','text',t,'hold',tv_hold(t,800)),
      jsonb_build_object('zone','atlas','hold',17000));
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'locations', n, t, 'On location', '#43C6B8', beats, d);
    total := total + d;
  end if;

  -- 9 · MAP (connections)
  n := n + 1;
  t := format(tv_pick(array['How %s Connects to Everything Else','%s on the Critical Map','The Web Around %s'], f.slug||':map'), f.title);
  d := tv_hold(t) + 16000;
  beats := jsonb_build_array(
    jsonb_build_object('zone','top','kicker','The map','text',t,'hold',tv_hold(t)),
    jsonb_build_object('zone','map','mapApi','/api/map?type=film&key='||f.slug,'mapFull','/map?m=critical&t=film&k='||f.slug,'hold',16000));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'map', n, t, 'The map', '#6E9BFF', beats, d);
  total := total + d;

  -- 10 · KINDRED (nearest films)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select rf.title || coalesce(' ('||rf.year||')','') txt
    from film_affinities a join films rf on rf.id = a.related_film_id
    where a.film_id = f.id and rf.visible and coalesce(rf.is_analyzed,true)
    order by a.score desc nulls last limit 5
  loop
    beats := beats || jsonb_build_object('zone','stack','text',rec.txt,'hold',3400);
    d := d + 3400;
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['If You Loved %s, Watch These Next','The Films Nearest to %s','%s Has Relatives — Meet Them'], f.slug||':kin'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Kindred films','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'kindred', n, t, 'Kindred films', '#EF7D9D', beats, d);
    total := total + d;
  end if;

  -- 11 · CLOSE
  n := n + 1;
  t := format(tv_pick(array['The %s File Stays Open','This Was the Short File on %s','%s — To Be Continued on Metatake'], f.slug||':close'), f.title);
  d := tv_hold(t, 800);
  beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','METATAKE TV','text',t,
    'sub', 'Read the full file — every take, every place, every list — at metatake.net/film/'||f.slug, 'hold', d));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'close', n, t, 'METATAKE TV', '#C8102E', beats, d);
  total := total + d;

  prog_dek := format('%s chapters · the misreading, the critics, the places, the canon', n);
  update tv_programs set seg_count = n, duration_ms = total, dek = prog_dek where id = prog_id;
  return jsonb_build_object('program', f.slug, 'title', prog_title, 'segments', n, 'duration_ms', total);
end $$;

-- ── the watch feed ────────────────────────────────────────────────────────
-- tv_watch(null,null)  → shelves: playlists + all programs (light, no beats)
-- tv_watch(list, null) → the playlist's full entries (film furniture + segments)
-- tv_watch(null, prog) → a single program's full entry
create or replace function public.tv_watch(p_list text default null, p_program text default null)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
with prog_full as (
  select p.id, p.slug, p.title, p.dek, p.seg_count, p.duration_ms, p.meta,
    jsonb_build_object(
      'title', f.title, 'year', f.year, 'slug', f.slug, 'director', f.director,
      'director_slug', f.director_slug, 'poster', f.poster_path, 'backdrop', f.backdrop_path,
      'clip', p.meta->'clips'->>0, 'clips', coalesce(p.meta->'clips','[]'::jsonb)) film,
    (select jsonb_agg(jsonb_build_object('id',s.id,'topic',s.topic,'seq',s.seq,'title',s.title,
       'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms) order by s.seq)
     from tv_segments s where s.program_id = p.id) segments
  from tv_programs p join films f on f.id = p.film_id
  where p.status = 'published'
)
select case
  when p_program is not null then
    jsonb_build_object('entries', coalesce((select jsonb_agg(jsonb_build_object(
      'slug',pf.slug,'title',pf.title,'dek',pf.dek,'film',pf.film,'segments',pf.segments))
      from prog_full pf where pf.slug = p_program), '[]'::jsonb))
  when p_list is not null then
    (select jsonb_build_object(
      'playlist', jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind),
      'entries', coalesce((
        select jsonb_agg(e order by e_pos) from (
          select i.pos e_pos,
            case when i.program_id is not null then
              (select jsonb_build_object('slug',pf.slug,'title',pf.title,'dek',pf.dek,'film',pf.film,'segments',pf.segments)
               from prog_full pf where pf.id = i.program_id)
            else
              (select jsonb_build_object('slug','seg-'||s.id,'title',s.title,'dek',null,
                 'film', pf.film,
                 'segments', jsonb_build_array(jsonb_build_object('id',s.id,'topic',s.topic,'seq',1,'title',s.title,
                   'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms)))
               from tv_segments s join prog_full pf on pf.id = s.program_id where s.id = i.segment_id)
            end e
          from tv_playlist_items i where i.playlist_id = pl.id
        ) q where e is not null), '[]'::jsonb))
     from tv_playlists pl where pl.slug = p_list)
  else
    jsonb_build_object(
      'playlists', coalesce((select jsonb_agg(jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind,
        'n',(select count(*) from tv_playlist_items i where i.playlist_id=pl.id)) order by pl.created_at)
        from tv_playlists pl), '[]'::jsonb),
      'programs', coalesce((select jsonb_agg(jsonb_build_object('slug',pf.slug,'title',pf.title,'dek',pf.dek,
        'seg_count',pf.seg_count,'duration_ms',pf.duration_ms,'film',pf.film) order by pf.title)
        from prog_full pf), '[]'::jsonb))
end
$$;

grant execute on function public.tv_watch(text, text) to anon, authenticated;
grant select on public.tv_programs, public.tv_segments, public.tv_playlists, public.tv_playlist_items to anon, authenticated;
