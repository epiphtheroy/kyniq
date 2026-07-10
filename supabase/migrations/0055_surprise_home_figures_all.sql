-- 0055_surprise_home_figures_all.sql
-- Adds 'poster' (films.poster_path) to the surprise_home base payload so the
-- v2 METATAKE TV mastplate can show the film poster. Otherwise identical to 0050.
-- Home "Surprise me" hero: keep the curated, film-anchored intent (one random
-- analyzed film seen through one lens) but widen the lens set. Adds six new
-- film-centric modes that draw on surfaces built since the original:
--   reception (what critics said), honors (the record it holds),
--   question (a Curious Q people ask), locations (where it takes place),
--   theorist (the film through one thinker's lens), misreadings_teaser
--   (the whole Strong-Misreadings article, by count). Each falls back to a
--   Strong Misreading when its data is absent, so no card ever comes up empty.
-- Weighting: misreading stays the plurality; the 8 original lenses + 6 new
-- ones round out the common pool; the rare "chip cloud" cards keep ~18%.

CREATE OR REPLACE FUNCTION public.surprise_home()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare f record; fig record; m text; r jsonb; base jsonb; arch jsonb; trp jsonb; cnt int;
begin
  select fi.* into f from films fi
    where fi.visible and coalesce(fi.is_analyzed,true)
      and exists(select 1 from figures g join takes t on t.figure_id=g.id
                 where g.film_id=fi.id and t.status='published' and t.take_title is not null)
    order by random() limit 1;
  if f.id is null then return jsonb_build_object('mode','empty'); end if;

  base := jsonb_build_object(
    'film_title', f.title, 'film_year', f.year, 'film_slug', f.slug,
    'director', f.director, 'director_slug', f.director_slug, 'backdrop', f.backdrop_path,
    'poster', f.poster_path,
    'clip', (select md.external_id from media md where md.entity_type='film' and md.entity_id=f.id and md.kind='video'
             order by (case when md.title ~* 'trailer|teaser' then 1 else 0 end), md.position nulls last limit 1));

  -- ~1 in 5 draws is a rare "chip cloud" card; the rest are the common lenses.
  -- Common pool: misreading keeps a x4 plurality, then the 8 original lenses and
  -- 6 newer ones — 19 slots, so every draw has real variety.
  if random() < 0.18 then
    m := (array['film_tropes','film_ideas','director_tropes','director_ideas'])[1+floor(random()*4)::int];
  else
    m := (array['misreading','misreading','misreading','misreading',
                'film_map','director_map','figure_links','watch_next','recommended_by','why_watch','where_to_start','director_next',
                'reception','honors','question','locations','theorist','misreadings_teaser','kindred','figures','invitation','lineage'])[1+floor(random()*22)::int];
  end if;

  if m = 'film_map' then
    r := jsonb_build_object('mode','film_map','label','The film''s map','subject', f.title || ' — connection map',
      'intro','Every figure, reading and trope in '||f.title||', and the films nearest it across the critical web.',
      'mapApi','/api/map?type=film&key='||f.slug,'mapFull','/map?m=critical&t=film&k='||f.slug,'href','/film/'||f.slug);

  elsif m = 'director_map' then
    if f.director_slug is null then m := 'misreading';
    else r := jsonb_build_object('mode','director_map','label','The director''s map','subject', coalesce(f.director,'The director') || ' — director map',
      'intro', coalesce(f.director,'This director')||'’s films, the readings they gather and the directors nearby.',
      'mapApi','/api/map?mode=directors&key='||f.director_slug,'mapFull','/map?m=directors&k='||f.director_slug,'href','/director/'||f.director_slug);
    end if;

  elsif m = 'figure_links' then
    select g.label, g.slug into fig from figures g where g.film_id=f.id and g.status='approved' and g.slug is not null order by random() limit 1;
    if fig.slug is null then m := 'misreading';
    else r := jsonb_build_object('mode','figure_links','label','This figure across films','subject', fig.label,
      'intro', fig.label||' in '||f.title||' — the tropes it carries and the films nearest it across the map.',
      'mapApi','/api/map?type=figure&key='||f.slug||'&key2='||fig.slug,'mapFull','/map?m=critical&t=figure&k='||f.slug||'&k2='||fig.slug,
      'href','/film/'||f.slug||'/figure/'||fig.slug);
    end if;

  elsif m = 'watch_next' then
    r := jsonb_build_object('mode','watch_next','label','Watch next','subject','After '||f.title||' — what to watch next',
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('title',n.rec_title,'year',n.rec_year,'director',n.rec_director,'reason',n.reason,
               'slug',tf.slug,'poster',coalesce(tf.poster_path,n.poster_path)) jb
        from film_next n left join films tf on tf.id=n.target_film_id
        where n.source_film_id=f.id order by n.position limit 6) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'recommended_by' then
    r := jsonb_build_object('mode','recommended_by','label','Recommended by','subject','Films that send you to '||f.title,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('title',sf.title,'year',sf.year,'slug',sf.slug,'reason',n.reason,'poster',sf.poster_path) jb
        from film_next n join films sf on sf.id=n.source_film_id
        where n.target_film_id=f.id and sf.visible order by n.created_at desc limit 6) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'why_watch' then
    r := jsonb_build_object('mode','why_watch','label','Why watch','subject','Why watch '||f.title,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('label',p->>'label','text',p->>'text') jb
        from film_asset a, jsonb_array_elements(a.lenses) l, jsonb_array_elements(l->'points') p
        where a.film_id=f.id limit 6) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'where_to_start' then
    if f.director_slug is null then m := 'misreading';
    else r := jsonb_build_object('mode','where_to_start','label','Where to start','subject','Where to start with '||coalesce(f.director,'this director'),
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('pos',p.pos,'title',p.film_title,'year',p.film_year,'slug',p.film_slug,'label',p.label,'reason',p.reason,
               'poster',fp.poster_path) jb
        from director_picks p left join films fp on fp.slug=p.film_slug
        where p.director_slug=f.director_slug order by p.pos) s));
      if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;
    end if;

  elsif m = 'director_next' then
    if f.director_slug is null then m := 'misreading';
    else r := jsonb_build_object('mode','director_next','label','Who''s next','subject','Where '||coalesce(f.director,'this director')||' sends you next',
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('name',dn.rec_name,'slug',dn.target_slug,'profile',dn.profile_path,'reason',dn.reason) jb
        from director_next dn where dn.director_slug=f.director_slug order by dn.pos limit 6) s));
      if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;
    end if;

  -- ── new film-anchored lenses ──────────────────────────────────────────────

  elsif m = 'reception' then
    r := jsonb_build_object('mode','reception','label','What critics said','subject','What critics made of '||f.title,
      'intro','How the reviews received '||f.title||', in the critics'' own words.',
      'href','/film/'||f.slug||'/reception',
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text',rc.dek_lead,
               'label', btrim(rc.outlet||coalesce(' · '||nullif(btrim(rc.critic),''),'')),
               'year', rc.review_year) jb
        from film_reception rc where rc.film_id=f.id and rc.dek_lead is not null
        order by random() limit 4) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'honors' then
    select count(*) into cnt from film_lineage_for(f.id);
    if cnt = 0 then m := 'misreading';
    else r := jsonb_build_object('mode','honors','label','The record','subject',f.title||' — the record it holds',
      'intro','What '||f.title||' has been listed among, nominated for and won.',
      'href', case when cnt >= 3 then '/film/lineage/'||f.slug else '/film/'||f.slug end,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text', l.list_label||coalesce(' ('||l.edition_year||')',''),
               'label', initcap(coalesce(l.result,'listed')),
               'won', (coalesce(l.result,'') ~* 'won|win')) jb
        from film_lineage_for(f.id) l
        order by (case when coalesce(l.result,'') ~* 'won|win' then 0 when l.result ~* 'nominat' then 1 else 2 end),
                 l.edition_year desc nulls last
        limit 7) s));
    end if;

  elsif m = 'question' then
    select jsonb_build_object('mode','question','label','A question people ask',
      'subject', case when qq.title_spoiler then coalesce(qq.safe_hook, qq.display_title, 'A spoiler-heavy question about '||f.title) else qq.title end,
      'intro','One of the questions viewers keep asking about '||f.title||' — taken up on Curious.',
      'href','/film/'||f.slug||'/q/'||qq.slug) into r
    from questions qq where qq.film_id=f.id and qq.status='published'
    order by coalesce(qq.view_count,0) desc, random() limit 1;
    if r is null then m := 'misreading'; end if;

  elsif m = 'locations' then
    r := jsonb_build_object('mode','locations','label','On location','subject','Where '||f.title||' takes place',
      'intro','The real places '||f.title||' was set in or shot in — charted on its atlas.',
      'href','/film/'||f.slug||'#df-atlas',
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text', l2.name,
               'label', nullif(btrim(coalesce(nullif(btrim(l2.country),''),'')||coalesce(' · '||nullif(btrim(l2.scene_role),''),'')), ''),
               'reason', nullif(btrim(l2.narrative_setting),'')) jb
        from film_locations l2 where l2.film_id=f.id and l2.name is not null
        order by (case when l2.tier='primary' then 0 else 1 end) nulls last, random() limit 6) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'theorist' then
    select jsonb_build_object('mode','theorist','label','Through a lens',
      'subject', f.title||' — through '||th.name,
      'intro', th.blurb,
      'line', tt.take_title, 'body', tt.rationale, 'framework', tt.framework, 'theorist', th.name,
      'fig_label', fgg.label,
      'href','/theorist/'||th.slug) into r
    from takes tt join figures fgg on fgg.id=tt.figure_id join theorists th on th.id=tt.theorist_id
    where fgg.film_id=f.id and tt.status='published' and th.slug is not null and tt.take_title is not null
    order by tt.strength desc nulls last, random() limit 1;
    if r is null then m := 'misreading'; end if;

  elsif m = 'misreadings_teaser' then
    select count(*) into cnt from takes t join figures g on g.id=t.figure_id
      where g.film_id=f.id and t.status='published' and t.take_title is not null;
    if cnt < 3 then m := 'misreading';
    else r := jsonb_build_object('mode','misreadings_teaser','label','Read against the grain',
      'subject', cnt||' strong misreadings of '||f.title,
      'intro','Every bold, defensible reading of '||f.title||', filed by the framework it argues from.',
      'href','/film/'||f.slug||'/misreadings',
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text',t.take_title,'label',t.framework) jb
        from takes t join figures g on g.id=t.figure_id
        where g.film_id=f.id and t.status='published' and t.take_title is not null
        order by t.strength desc nulls last limit 5) s));
    end if;

  elsif m = 'kindred' then
    r := jsonb_build_object('mode','kindred','label','Kindred films','subject','Films kindred to '||f.title,
      'intro','Nearest neighbours across shared tropes and taste — the films most like '||f.title||'.',
      'href','/film/'||f.slug,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('title',rf.title,'year',rf.year,'slug',rf.slug) jb
        from film_affinities a join films rf on rf.id=a.related_film_id
        where a.film_id=f.id and rf.visible and coalesce(rf.is_analyzed,true)
        order by a.score desc nulls last limit 5) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'figures' then
    r := jsonb_build_object('mode','figures','label','The figures','subject','Who moves through '||f.title,
      'intro','The characters, forces and images the film turns on.',
      'href','/film/'||f.slug,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text',g.label,'reason', nullif(btrim(left(g.description,150)),'')) jb
        from figures g where g.film_id=f.id and g.status='approved' and g.label is not null and g.label not ilike 'the film as a whole'
        order by (case when g.description is not null then 0 else 1 end), random() limit 14) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  elsif m = 'invitation' then
    select jsonb_build_object('mode','invitation','label','An invitation',
      'subject','An invitation to '||f.title, 'body', t.rationale, 'fig_label', fg.label,
      'href','/film/'||f.slug||'/figure/'||fg.slug||'#t-'||t.id) into r
    from takes t join figures fg on fg.id=t.figure_id
    where fg.film_id=f.id and t.status='published' and t.is_invitation=true and t.rationale is not null
    order by t.strength desc nulls last, random() limit 1;
    if r is null then m := 'misreading'; end if;

  elsif m = 'lineage' then
    r := jsonb_build_object('mode','lineage','label','In the canon','subject',f.title||' — where it stands',
      'intro','The polls, canons and lists '||f.title||' has entered.',
      'href', case when (select count(*) from film_lineage_for(f.id)) >= 3 then '/film/lineage/'||f.slug else '/film/'||f.slug end,
      'items',(select jsonb_agg(jb) from (
        select jsonb_build_object('text', l.list_label,
               'label', (case when l.rank is not null then '#'||l.rank else initcap(coalesce(l.result,'listed')) end)||coalesce(' · '||l.edition_year,'')) jb
        from film_lineage_for(f.id) l
        order by (l.rank is null), l.rank asc nulls last, l.edition_year desc nulls last limit 6) s));
    if r->'items' is null or jsonb_typeof(r->'items') = 'null' then m := 'misreading'; end if;

  -- ── rare chip clouds ──────────────────────────────────────────────────────

  elsif m = 'film_tropes' then
    r := jsonb_build_object('mode','film_tropes','label','Archetypes & tropes','subject','The shape of '||f.title,'href','/film/'||f.slug,
      'chips',(select jsonb_agg(jb order by random()) from (
        select distinct jsonb_build_object('text',tn.label,'kind','archetype') jb
          from figures g join figure_taxonomy ft on ft.figure_id=g.id join taxonomy_nodes tn on tn.id=ft.node_id
          where g.film_id=f.id and tn.label is not null
        union
        select distinct jsonb_build_object('text',mt.title,'kind','trope') jb
          from takes t join figures g on g.id=t.figure_id join meta_takes mt on mt.id=t.trope_id and mt.kind='figure_type'
          where g.film_id=f.id and t.status='published' and mt.title is not null
      ) s));
    if r->'chips' is null or jsonb_typeof(r->'chips') = 'null' then m := 'misreading'; end if;

  elsif m = 'film_ideas' then
    r := jsonb_build_object('mode','film_ideas','label','Ideas','subject','The ideas in '||f.title,'href','/film/'||f.slug,
      'chips',(select jsonb_agg(jb order by random()) from (
        select distinct jsonb_build_object('text',coalesce(c.canon_name,c.name)) jb
          from takes t join figures g on g.id=t.figure_id join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id)
          where g.film_id=f.id and t.concept is not null and t.status='published'
      ) s));
    if r->'chips' is null or jsonb_typeof(r->'chips') = 'null' then m := 'misreading'; end if;

  elsif m = 'director_tropes' then
    if f.director_slug is null then m := 'misreading';
    else
      arch := (select jsonb_agg(jb order by random()) from (
        select distinct jsonb_build_object('text',tn.label) jb
          from films fl join figures g on g.film_id=fl.id join figure_taxonomy ft on ft.figure_id=g.id join taxonomy_nodes tn on tn.id=ft.node_id
          where fl.director_slug=f.director_slug and tn.label is not null limit 18) s);
      trp := (select jsonb_agg(jb order by random()) from (
        select distinct jsonb_build_object('text',mt.title) jb
          from films fl join figures g on g.film_id=fl.id join takes t on t.figure_id=g.id and t.status='published'
          join meta_takes mt on mt.id=t.trope_id and mt.kind='figure_type'
          where fl.director_slug=f.director_slug and mt.title is not null limit 18) s);
      if arch is null and trp is null then m := 'misreading';
      else r := jsonb_build_object('mode','director_tropes','label','Archetypes & tropes',
        'subject',coalesce(f.director,'This director')||' — the recurring shapes','href','/director/'||f.director_slug,
        'groups', jsonb_build_array(
          jsonb_build_object('title','Archetypes','chips',coalesce(arch,'[]'::jsonb)),
          jsonb_build_object('title','Tropes','chips',coalesce(trp,'[]'::jsonb))));
      end if;
    end if;

  elsif m = 'director_ideas' then
    if f.director_slug is null then m := 'misreading';
    else r := jsonb_build_object('mode','director_ideas','label','Ideas','subject',coalesce(f.director,'This director')||' — the ideas','href','/director/'||f.director_slug,
      'chips',(select jsonb_agg(jb order by random()) from (
        select distinct jsonb_build_object('text',coalesce(c.canon_name,c.name)) jb
          from films fl join figures g on g.film_id=fl.id join takes t on t.figure_id=g.id and t.status='published'
          join sm_concepts c on exists (select 1 from public.concept_map k9 where k9.raw_l=lower(btrim(t.concept)) and k9.concept_id=c.id)
          where fl.director_slug=f.director_slug and t.concept is not null limit 24) s));
      if r->'chips' is null or jsonb_typeof(r->'chips') = 'null' then m := 'misreading'; end if;
    end if;
  end if;

  if m = 'misreading' or r is null then
    select jsonb_build_object('mode','misreading','label','Strong Misreading','subject', t.take_title,
      'line', t.take_title,'body', t.rationale,'leap', t.leap,'framework', t.framework,'theorist', t.theorist_name,
      'fig_label', fg.label,'fig_slug', fg.slug,'href','/film/'||f.slug||'/figure/'||fg.slug||'#t-'||t.id) into r
    from takes t join figures fg on fg.id=t.figure_id
    where fg.film_id=f.id and t.status='published' and t.take_title is not null
    order by t.strength desc nulls last, random() limit 1;
  end if;

  return base || coalesce(r, jsonb_build_object('mode','misreading'));
end; $function$;
