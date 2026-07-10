-- 0058_tv_engine_v2.sql  ⚠️ NOT YET APPLIED — apply only per WORKORDER-tv-corpus-build.md
-- METATAKE TV engine v2: (a) the eligibility gate that excludes data-thin films,
-- (b) five new extractable topics (theorist / why_watch / question / watch_next /
-- invitation), (c) a server-safe batch driver with advisory lock + statement
-- timeout. Compiler signature unchanged (uuid) — CREATE OR REPLACE is safe
-- (no overload trap). Programs are stamped meta.engine='v2' so the batch driver
-- can find v1/stale programs and rebuild them.

-- ── eligibility gate ─────────────────────────────────────────────────────
-- A film qualifies when it has: a clean trailer/teaser, a misreading backbone
-- (≥3 titled takes), and at least p_min_rich of the 10 cheap data families.
-- All probes are single-film index lookups — O(1) per film, no wide joins.
create or replace function public.tv_eligible(p_film uuid, p_min_rich int default 4)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare f record; v_takes int; v_rich int := 0; v_clip boolean;
begin
  select id, visible, coalesce(is_analyzed,true) analyzed into f from films where id = p_film;
  if f.id is null or not f.visible or not f.analyzed then
    return jsonb_build_object('ok', false, 'reason', 'not visible/analyzed');
  end if;

  select exists (
    select 1 from media md where md.entity_type='film' and md.entity_id=p_film and md.kind='video'
      and md.title ~* 'trailer|teaser'
      and md.title !~* 'explain|featurette|behind the scenes|interview|review|breakdown|react|making of|commentary'
  ) into v_clip;
  if not v_clip then return jsonb_build_object('ok', false, 'reason', 'no clean trailer'); end if;

  select count(*) into v_takes from takes t join figures g on g.id=t.figure_id
   where g.film_id=p_film and t.status='published' and t.take_title is not null;
  if v_takes < 3 then return jsonb_build_object('ok', false, 'reason', 'takes<3', 'takes', v_takes); end if;

  v_rich :=
      (select (count(*)>=4)::int from (select 1 from figures where film_id=p_film and status='approved'
         and label is not null and label not ilike 'the film as a whole' limit 4) s)
    + (exists(select 1 from film_reception  where film_id=p_film and dek_lead is not null))::int
    + (exists(select 1 from film_lineage    where film_id=p_film))::int
    + (exists(select 1 from film_locations  where film_id=p_film and name is not null and lat is not null))::int
    + (exists(select 1 from film_affinities where film_id=p_film))::int
    + (exists(select 1 from film_next       where source_film_id=p_film))::int
    + (exists(select 1 from questions       where film_id=p_film and status='published'))::int
    + (exists(select 1 from film_asset      where film_id=p_film))::int
    + (exists(select 1 from takes t join figures g on g.id=t.figure_id
              where g.film_id=p_film and t.status='published' and t.theorist_id is not null))::int
    + (exists(select 1 from takes t join figures g on g.id=t.figure_id
              where g.film_id=p_film and t.status='published' and t.is_invitation and t.rationale is not null))::int;

  return jsonb_build_object('ok', v_rich >= p_min_rich, 'reason',
    case when v_rich >= p_min_rich then 'ok' else 'rich<'||p_min_rich end,
    'takes', v_takes, 'rich', v_rich);
end $$;

-- ── compiler v2 ──────────────────────────────────────────────────────────
-- v1 topics + theorist / why_watch / question / watch_next / invitation.
-- Chapter order: open · misreading×3 · theorist · figures · ideas · why_watch ·
-- reception · question · honors · canon · locations · map · kindred ·
-- watch_next · invitation · close  (≤18; the player random-samples on air).
create or replace function public.tv_compile_film(p_film uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  f record; prog_id uuid; n int := 0; total int := 0;
  clips text[]; beats jsonb; d int; t text; k text; arr text[];
  prog_title text; rec record; body_chunks text[]; c text; used_takes uuid[] := '{}';
begin
  select * into f from films where id = p_film;
  if f.id is null then return jsonb_build_object('error','no film'); end if;

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
  values (f.id, f.slug, prog_title, jsonb_build_object('clips', to_jsonb(clips), 'engine', 'v2'))
  returning id into prog_id;

  -- 1 · OPEN
  n := n + 1; d := tv_hold(prog_title, 1600);
  beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Now on METATAKE TV','text',prog_title,
    'sub', format('%s (%s) · dir. %s', f.title, f.year, coalesce(f.director,'—')), 'hold', d));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'open', n, prog_title, 'Now on METATAKE TV', '#C8102E', beats, d);
  total := total + d;

  -- 2-4 · MISREADING — one module per take (top 3)
  for rec in
    select tk.id, tk.take_title, tk.rationale, tk.leap, tk.framework, tk.theorist_name
    from takes tk join figures g on g.id = tk.figure_id
    where g.film_id = f.id and tk.status='published' and tk.take_title is not null
    order by tk.strength desc nulls last limit 3
  loop
    used_takes := used_takes || rec.id;
    n := n + 1;
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

  -- 5 · THEORIST — the film through one thinker (a take NOT already used)
  select tk.take_title, tk.rationale, tk.framework, th.name theorist
    into rec
  from takes tk join figures g on g.id = tk.figure_id join theorists th on th.id = tk.theorist_id
  where g.film_id = f.id and tk.status='published' and tk.take_title is not null
    and not (tk.id = any(used_takes))
  order by tk.strength desc nulls last limit 1;
  if rec.take_title is not null then
    n := n + 1;
    t := format(tv_pick(array['%s, Read Through '||rec.theorist,'What '||rec.theorist||' Would See in %s','%s Under the '||rec.theorist||' Lens'], f.slug||':theo'), f.title);
    k := 'Through a lens' || coalesce(' · '||rec.framework,'');
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker',k,'text',t,'hold',tv_hold(t)));
    d := tv_hold(t);
    beats := beats || jsonb_build_object('zone','sub','kicker','The reading','text',rec.take_title,'hold',tv_hold(rec.take_title,800));
    d := d + tv_hold(rec.take_title, 800);
    body_chunks := tv_chunks(rec.rationale);
    for i in 1..least(coalesce(array_length(body_chunks,1),0), 2) loop
      c := body_chunks[i];
      beats := beats || jsonb_build_object('zone','sub','text',c,'hold',tv_hold(c));
      d := d + tv_hold(c);
    end loop;
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'theorist', n, t, k, '#9B8CFF', beats, d);
    total := total + d;
  end if;

  -- 6 · FIGURES (chip cloud)
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

  -- 7 · IDEAS (concept chip cloud)
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

  -- 8 · WHY WATCH (film_asset lens points, stacked)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select p->>'label' lab, p->>'text' txt
    from film_asset a, jsonb_array_elements(a.lenses) l, jsonb_array_elements(l->'points') p
    where a.film_id = f.id limit 4
  loop
    beats := beats || jsonb_build_object('zone','stack','text',coalesce(rec.lab,'Why watch'),'sub',rec.txt,'hold',3600);
    d := d + 3600;
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['Why %s Is Worth Your Evening','The Case for Watching %s Tonight','%s: The Case For'], f.slug||':why'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Why watch','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'why_watch', n, t, 'Why watch', '#8FBF6F', beats, d);
    total := total + d;
  end if;

  -- 9 · RECEPTION (quotes)
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

  -- 10 · QUESTION (one Curious question, spoiler-safe title)
  select case when qq.title_spoiler then coalesce(qq.safe_hook, qq.display_title) else qq.title end q_title
    into rec
  from questions qq where qq.film_id=f.id and qq.status='published'
    and (not qq.title_spoiler or coalesce(qq.safe_hook, qq.display_title) is not null)
  order by coalesce(qq.view_count,0) desc, random() limit 1;
  if rec.q_title is not null then
    n := n + 1; d := tv_hold(rec.q_title, 1200);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','A question people ask','text',rec.q_title,
      'sub','Taken up on Curious — the answer is on the film''s page.','hold',d));
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'question', n, rec.q_title, 'A question people ask', '#5FB7E8', beats, d);
    total := total + d;
  end if;

  -- 11 · HONORS
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

  -- 12 · CANON (ranked lists)
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

  -- 13 · LOCATIONS (the atlas)
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

  -- 14 · MAP (connections)
  n := n + 1;
  t := format(tv_pick(array['How %s Connects to Everything Else','%s on the Critical Map','The Web Around %s'], f.slug||':map'), f.title);
  d := tv_hold(t) + 16000;
  beats := jsonb_build_array(
    jsonb_build_object('zone','top','kicker','The map','text',t,'hold',tv_hold(t)),
    jsonb_build_object('zone','map','mapApi','/api/map?type=film&key='||f.slug,'mapFull','/map?m=critical&t=film&k='||f.slug,'hold',16000));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'map', n, t, 'The map', '#6E9BFF', beats, d);
  total := total + d;

  -- 15 · KINDRED (nearest by affinity)
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
    t := format(tv_pick(array['The Films Nearest to %s','%s Has Relatives — Meet Them','The Family Tree of %s'], f.slug||':kin'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Kindred films','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'kindred', n, t, 'Kindred films', '#EF7D9D', beats, d);
    total := total + d;
  end if;

  -- 16 · WATCH NEXT (editorial recommendations, with reasons)
  beats := '[]'::jsonb; d := 0;
  for rec in
    select coalesce(tf.title, x.rec_title) || coalesce(' ('||coalesce(tf.year, x.rec_year)||')','') txt, x.reason
    from film_next x left join films tf on tf.id = x.target_film_id
    where x.source_film_id = f.id order by x.position limit 5
  loop
    beats := beats || jsonb_build_object('zone','stack','text',rec.txt,'sub',rec.reason,'hold',3500);
    d := d + 3500;
  end loop;
  if jsonb_array_length(beats) > 0 then
    n := n + 1;
    t := format(tv_pick(array['If You Loved %s, Watch These Next','After %s: The Programme','Where to Go After %s'], f.slug||':nxt'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','Watch next','text',t,'hold',tv_hold(t))) || beats;
    d := d + tv_hold(t);
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'watch_next', n, t, 'Watch next', '#F08A3C', beats, d);
    total := total + d;
  end if;

  -- 17 · INVITATION (the director/context invitation blurb)
  select tk.rationale into rec
  from takes tk join figures g on g.id = tk.figure_id
  where g.film_id = f.id and tk.status='published' and tk.is_invitation and tk.rationale is not null
  order by tk.strength desc nulls last limit 1;
  if rec.rationale is not null then
    n := n + 1;
    t := format(tv_pick(array['An Invitation to %s','Before You Press Play on %s','%s: Where to Begin'], f.slug||':inv'), f.title);
    beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','An invitation','text',t,'hold',tv_hold(t,1000)));
    d := tv_hold(t, 1000);
    body_chunks := tv_chunks(rec.rationale);
    for i in 1..least(coalesce(array_length(body_chunks,1),0), 3) loop
      c := body_chunks[i];
      beats := beats || jsonb_build_object('zone','sub','text',c,'hold',tv_hold(c));
      d := d + tv_hold(c);
    end loop;
    insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
    values (prog_id, f.id, 'invitation', n, t, 'An invitation', '#5FC9A8', beats, d);
    total := total + d;
  end if;

  -- 18 · CLOSE
  n := n + 1;
  t := format(tv_pick(array['%s — The File Stays Open','This Was the Short File on %s','%s — To Be Continued on Metatake'], f.slug||':close'), f.title);
  d := tv_hold(t, 800);
  beats := jsonb_build_array(jsonb_build_object('zone','top','kicker','METATAKE TV','text',t,
    'sub', 'Read the full file — every take, every place, every list — at metatake.net/film/'||f.slug, 'hold', d));
  insert into tv_segments (program_id, film_id, topic, seq, title, kicker, accent, beats, duration_ms)
  values (prog_id, f.id, 'close', n, t, 'METATAKE TV', '#C8102E', beats, d);
  total := total + d;

  update tv_programs set seg_count = n, duration_ms = total,
    dek = format('%s chapters · the misreading, the critics, the places, the canon', n)
  where id = prog_id;
  return jsonb_build_object('program', f.slug, 'title', prog_title, 'segments', n, 'duration_ms', total);
end $$;

-- ── server-safe batch driver ─────────────────────────────────────────────
-- One call = one small batch. Advisory lock prevents concurrent runs; a local
-- statement_timeout caps damage; the runner sleeps BETWEEN calls (see the
-- work order) so the DB breathes. Returns progress so the runner can stop.
create or replace function public.tv_compile_batch(p_limit int default 20, p_min_rich int default 4)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_film record; v_done int := 0; v_skipped int := 0; v_remaining int; g jsonb;
begin
  if not pg_try_advisory_lock(777001) then
    return jsonb_build_object('locked', true);
  end if;
  begin
    set local statement_timeout = '120s';
    for v_film in
      select f.id from films f
      left join tv_programs p on p.film_id = f.id and p.meta->>'engine' = 'v2'
      where f.visible and coalesce(f.is_analyzed,true) and p.id is null
      order by f.id
      limit p_limit * 3          -- headroom: gate will skip thin films
    loop
      exit when v_done >= p_limit;
      g := tv_eligible(v_film.id, p_min_rich);
      if (g->>'ok')::boolean then
        perform tv_compile_film(v_film.id);
        v_done := v_done + 1;
      else
        -- stamp a skip marker so this film is not re-probed every batch
        insert into tv_programs (film_id, slug, title, status, meta)
        values (v_film.id,
                (select slug from films where id=v_film.id),
                'ineligible', 'skipped',
                jsonb_build_object('engine','v2','skip', g))
        on conflict (film_id) do update
          set status='skipped', meta=jsonb_build_object('engine','v2','skip', g), built_at=now();
        v_skipped := v_skipped + 1;
      end if;
    end loop;
  exception when others then
    perform pg_advisory_unlock(777001);
    raise;
  end;
  select count(*) into v_remaining
  from films f left join tv_programs p on p.film_id = f.id and p.meta->>'engine' = 'v2'
  where f.visible and coalesce(f.is_analyzed,true) and p.id is null;
  perform pg_advisory_unlock(777001);
  return jsonb_build_object('compiled', v_done, 'skipped', v_skipped, 'remaining', v_remaining);
end $$;

-- ── playlist auto-builder (run once after the corpus build) ──────────────
-- Genre lists (films kind) for genres with enough programs, plus the global
-- topic cut refresh and one genre×topic demo (the "action-film locations" shape).
create or replace function public.tv_build_playlists(p_min_films int default 8, p_max_items int default 40)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare g record; pl uuid; made int := 0;
begin
  set local statement_timeout = '60s';
  -- genre playlists
  for g in
    select genre, count(*) n from (
      select unnest(f.genres) genre, f.id
      from tv_programs p join films f on f.id = p.film_id
      where p.status = 'published') s
    group by 1 having count(*) >= p_min_films
  loop
    delete from tv_playlists where slug = 'genre-'||lower(replace(g.genre,' ','-'));
    insert into tv_playlists (slug, title, dek, kind, rule)
    values ('genre-'||lower(replace(g.genre,' ','-')),
            g.genre||' Files',
            'The '||lower(g.genre)||' programmes — misreadings, verdicts and the places they really happened.',
            'films', jsonb_build_object('genre', g.genre))
    returning id into pl;
    insert into tv_playlist_items (playlist_id, pos, program_id)
    select pl, row_number() over (order by f.year desc), p.id
    from tv_programs p join films f on f.id = p.film_id
    where p.status='published' and g.genre = any(f.genres)
    limit p_max_items;
    made := made + 1;
  end loop;

  -- refresh the global On Location topic cut
  delete from tv_playlists where slug = 'on-location';
  insert into tv_playlists (slug, title, dek, kind, rule)
  values ('on-location','On Location','Only the places — every film''s shooting-map chapter, cut into one reel.',
          'segments','{"topic":"locations"}'::jsonb)
  returning id into pl;
  insert into tv_playlist_items (playlist_id, pos, segment_id)
  select pl, row_number() over (order by f.title), s.id
  from tv_segments s join films f on f.id = s.film_id
  join tv_programs p on p.id = s.program_id and p.status='published'
  where s.topic = 'locations' limit p_max_items;

  return jsonb_build_object('genre_playlists', made);
end $$;

-- ── tv_watch v2 — scale-safe feed ────────────────────────────────────────
-- v1's shelf branch materialized EVERY program's segments+beats inside the CTE
-- (fine at 10 programs, a bomb at 2,000). v2: the shelf is beats-free and capped;
-- segments are aggregated ONLY for the requested list/program. Same signature.
create or replace function public.tv_watch(p_list text default null, p_program text default null)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
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
      'playlist', jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind),
      'entries', coalesce((
        select jsonb_agg(e order by e_pos) from (
          select i.pos e_pos,
            case when i.program_id is not null then
              (select jsonb_build_object('slug',fj.slug,'title',fj.title,'dek',fj.dek,'film',fj.film,
                 'segments', (select jsonb_agg(jsonb_build_object('id',s.id,'topic',s.topic,'seq',s.seq,'title',s.title,
                                'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms) order by s.seq)
                              from tv_segments s where s.program_id = fj.pid))
               from film_j fj where fj.pid = i.program_id)
            else
              (select jsonb_build_object('slug','seg-'||s.id,'title',s.title,'dek',null,
                 'film', fj.film,
                 'segments', jsonb_build_array(jsonb_build_object('id',s.id,'topic',s.topic,'seq',1,'title',s.title,
                   'kicker',s.kicker,'accent',s.accent,'beats',s.beats,'duration_ms',s.duration_ms)))
               from tv_segments s join film_j fj on fj.pid = s.program_id where s.id = i.segment_id)
            end e
          from tv_playlist_items i where i.playlist_id = pl.id
          order by i.pos limit 60
        ) q where e is not null), '[]'::jsonb))
     from tv_playlists pl where pl.slug = p_list)
  else
    jsonb_build_object(
      'playlists', coalesce((select jsonb_agg(jsonb_build_object('slug',pl.slug,'title',pl.title,'dek',pl.dek,'kind',pl.kind,
        'n',(select count(*) from tv_playlist_items i where i.playlist_id=pl.id)) order by pl.created_at)
        from tv_playlists pl), '[]'::jsonb),
      'programs', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('slug',fj.slug,'title',fj.title,'dek',fj.dek,
          'seg_count',fj.seg_count,'duration_ms',fj.duration_ms,'film',fj.film) x
        from film_j fj order by fj.title limit 120) s), '[]'::jsonb))
end
$$;

grant execute on function public.tv_eligible(uuid, int) to anon, authenticated;
