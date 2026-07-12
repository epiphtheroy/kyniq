-- ④ film_sentences — the 13 rule-based pattern fills (LLM-0), film-scoped to {film_ids_array}.
-- Reconstructed for the engine (factory) 2026-07-12 from the CANONICAL templates in
-- sentence-engine/Template_Sentence_Engine_Parasite_EN.md (A/B/C/G/H/I verbatim) + the live
-- film_sentences structure (D/E/F/J/L/M/N) + MASS-PRODUCTION.md salience formulas.
-- Every INSERT is ON CONFLICT DO NOTHING (dedupe index film_id,pattern,md5(sentence)) → idempotent.
-- Brand contract: factual v1 style, film-title-first, entity-FK-linked. LLM 0, random 0.
-- Each pattern INSERT is separated by the split marker so sentence-refresh runs them one by one.

-- A_affinity — neighbor film + shared interpretations
insert into public.film_sentences (film_id, pattern, sentence, other_film_id, meta_take_ids, kin, salience, nums)
select b.id, 'A_affinity',
  format('%s (%s) shares %s interpretation%s with %s''s %s (%s): %s.',
    b.title,b.year,cardinality(fa.shared_meta_take_ids),
    case when cardinality(fa.shared_meta_take_ids)=1 then '' else 's' end,
    rf.director,rf.title,rf.year,
    (select string_agg(distinct '‘'||mt.title||'’',', ') from public.meta_takes mt where mt.id=any(fa.shared_meta_take_ids))),
  fa.related_film_id, fa.shared_meta_take_ids,
  (select kin from public.film_kinship k where k.film_id=b.id and k.related_film_id=fa.related_film_id),
  20 + cardinality(fa.shared_meta_take_ids)*10,
  jsonb_build_object('year_gap',abs(coalesce(b.year,0)-coalesce(rf.year,0)),'shared_count',cardinality(fa.shared_meta_take_ids))
from public.film_affinities fa
join public.films rf on rf.id=fa.related_film_id
join public.films b on b.id=fa.film_id
where fa.film_id = any({film_ids_array}) and cardinality(fa.shared_meta_take_ids)>=1
on conflict do nothing;
-- @@split
-- B_bridge — one shared node links two films (+ gloss), one row per shared node
insert into public.film_sentences (film_id, pattern, sentence, other_film_id, meta_take_ids, salience, nums)
select b.id, 'B_bridge',
  format('%s (%s) is linked to %s''s %s (%s) by the interpretation ‘%s’%s.',
    b.title,b.year,rf.director,rf.title,rf.year,mt.title,
    case when coalesce(mt.laconic,'')<>'' then ' — '||rtrim(mt.laconic,'.') else '' end),
  fa.related_film_id, array[mt.id],
  30 + coalesce((select round(100.0/greatest(ns.film_count,1)) from public.sentence_node_stats ns where ns.meta_take_id=mt.id),0),
  jsonb_build_object('year_gap',abs(coalesce(b.year,0)-coalesce(rf.year,0)),
     'node_films',coalesce((select film_count from public.sentence_node_stats ns where ns.meta_take_id=mt.id),0))
from public.film_affinities fa
join public.films rf on rf.id=fa.related_film_id
join lateral unnest(fa.shared_meta_take_ids) s(id) on true
join public.meta_takes mt on mt.id=s.id
join public.films b on b.id=fa.film_id
where fa.film_id = any({film_ids_array})
on conflict do nothing;
-- @@split
-- C_reading — scene (figure) + theorist + concept + intensity
insert into public.film_sentences (film_id, pattern, sentence, figure_id, take_id, theorist_id, theorist_name, concept, framework, salience, nums)
select b.id, 'C_reading',
  format('%s''s ‘%s’ is read through %s''s ‘%s’ at intensity %s/5 — %s.',
    b.title,g.label,tk.theorist_name,tk.concept,coalesce(tk.strength,3),tk.take_title),
  g.id, tk.id, tk.theorist_id, tk.theorist_name, tk.concept, tk.framework,
  20 + coalesce(tk.strength,3)*6,
  jsonb_build_object('strength',coalesce(tk.strength,3),
     'concept_films',coalesce((select film_count from public.sentence_concept_stats cs where cs.theorist_name=tk.theorist_name and cs.concept=tk.concept),1))
from public.figures g
join public.takes tk on tk.figure_id=g.id and tk.status='published'
join public.films b on b.id=g.film_id
where g.film_id = any({film_ids_array}) and tk.theorist_name is not null and tk.concept is not null and tk.take_title is not null
on conflict do nothing;
-- @@split
-- G_theorist_twin — pairs read through the same theorist·concept
insert into public.film_sentences (film_id, pattern, sentence, other_film_id, take_id, theorist_id, theorist_name, concept, salience, nums)
select b.id, 'G_theorist_twin',
  format('%s and %s (%s, %s) are both read through %s''s ‘%s’.',
    b.title, of.title, of.director, of.year, t1.theorist_name, t1.concept),
  of.id, t1.id, t1.theorist_id, t1.theorist_name, t1.concept,
  15,
  jsonb_build_object('concept_films',coalesce((select film_count from public.sentence_concept_stats cs where cs.theorist_name=t1.theorist_name and cs.concept=t1.concept),2))
from public.takes t1
join public.figures f1 on f1.id=t1.figure_id
join public.takes t2 on t2.theorist_name=t1.theorist_name and t2.concept=t1.concept and t2.status='published'
join public.figures f2 on f2.id=t2.figure_id
join public.films of on of.id=f2.film_id and of.visible
join public.films b on b.id=f1.film_id
where f1.film_id = any({film_ids_array}) and f2.film_id<>f1.film_id
  and t1.status='published' and t1.theorist_name is not null and t1.concept is not null
on conflict do nothing;
-- @@split
-- I_lens_twin — same lens (scene · intensity) shared with another film
insert into public.film_sentences (film_id, pattern, sentence, other_film_id, figure_id, take_id, theorist_id, theorist_name, concept, framework, salience, nums)
select b.id, 'I_lens_twin',
  format('%s''s ‘%s’ (%s''s ‘%s’, intensity %s/5) shares its reading lens with %s (%s, %s).',
    b.title, f1.label, t1.theorist_name, t1.concept, coalesce(t1.strength,3), of.title, of.year, of.director),
  of.id, f1.id, t1.id, t1.theorist_id, t1.theorist_name, t1.concept, t1.framework,
  12,
  jsonb_build_object('strength',coalesce(t1.strength,3),
     'concept_films',coalesce((select film_count from public.sentence_concept_stats cs where cs.theorist_name=t1.theorist_name and cs.concept=t1.concept),2))
from public.figures f1
join public.takes t1 on t1.figure_id=f1.id and t1.status='published'
join public.takes t2 on t2.theorist_name=t1.theorist_name and t2.concept=t1.concept and t2.id<>t1.id and t2.status='published'
join public.figures f2 on f2.id=t2.figure_id
join public.films of on of.id=f2.film_id and of.visible
join public.films b on b.id=f1.film_id
where f1.film_id = any({film_ids_array}) and f2.film_id<>f1.film_id
  and t1.theorist_name is not null and t1.take_title is not null
on conflict do nothing;
-- @@split
-- H_dense — base (+ Metascore·RT) + neighbor + # shared + key node (gated on ratings)
insert into public.film_sentences (film_id, pattern, sentence, other_film_id, meta_take_ids, salience, nums)
select b.id, 'H_dense',
  format('%s (%s, %s · Metascore %s · RT %s%%) shares %s interpretation%s with %s''s %s (%s); ‘%s’ is the key link.',
    b.title,b.year,b.director,br.metascore,br.rt_tomatometer,cardinality(fa.shared_meta_take_ids),
    case when cardinality(fa.shared_meta_take_ids)=1 then '' else 's' end,
    rf.director,rf.title,rf.year,
    (select min(mt.title) from public.meta_takes mt where mt.id=any(fa.shared_meta_take_ids))),
  fa.related_film_id, fa.shared_meta_take_ids,
  35,
  jsonb_build_object('rt',br.rt_tomatometer,'metascore',br.metascore,'shared_count',cardinality(fa.shared_meta_take_ids))
from public.film_affinities fa
join public.films rf on rf.id=fa.related_film_id
join public.films b on b.id=fa.film_id
join public.film_ratings br on br.film_id=b.id and (br.metascore is not null or br.rt_tomatometer is not null)
where fa.film_id = any({film_ids_array}) and cardinality(fa.shared_meta_take_ids)>=1
on conflict do nothing;
-- @@split
-- D_award — lineage list membership
insert into public.film_sentences (film_id, pattern, sentence, lineage_list_id, lineage_edition_id, salience, nums)
select b.id, 'D_award',
  format('%s is listed in ‘%s’%s.', b.title, ll.label,
    case when le.year is not null then ' ('||le.year||')' else '' end),
  ll.id, le.id,
  25,
  jsonb_build_object('rank',fl.rank,'year',le.year,'facet',ll.facet,'result',fl.result)
from public.film_lineage fl
join public.lineage_lists ll on ll.id=fl.list_id
left join public.lineage_editions le on le.id=fl.edition_id
join public.films b on b.id=fl.film_id
where fl.film_id = any({film_ids_array})
on conflict do nothing;
-- @@split
-- L_trope — figure carries a trope, N films stage it
insert into public.film_sentences (film_id, pattern, sentence, meta_take_ids, take_id, figure_id, salience, nums)
select b.id, 'L_trope',
  format('%s''s ‘%s’ carries the trope ‘%s’ — one of %s film%s in the catalog that stage it.',
    b.title, g.label, mt.title, coalesce(ns.film_count,1),
    case when coalesce(ns.film_count,1)=1 then '' else 's' end),
  array[mt.id], tk.id, g.id,
  10 + round(100.0/greatest(coalesce(ns.film_count,1),1)),
  jsonb_build_object('trope_films',coalesce(ns.film_count,1))
from public.takes tk
join public.figures g on g.id=tk.figure_id
join public.meta_takes mt on mt.id=tk.trope_id and mt.kind='figure_type' and mt.status='published'
left join public.sentence_node_stats ns on ns.meta_take_id=mt.id
join public.films b on b.id=g.film_id
where g.film_id = any({film_ids_array}) and tk.status='published'
on conflict do nothing;
-- @@split
-- M_frame — # readings drawn through each Strong-Misreading framework
insert into public.film_sentences (film_id, pattern, sentence, framework, salience, nums)
select b.id, 'M_frame',
  format('%s (%s) draws %s reading%s through the ‘%s’ frame.',
    b.title, b.year, cnt, case when cnt=1 then '' else 's' end, tk.framework),
  tk.framework,
  least(cnt*6, 40),
  jsonb_build_object('frame_count',cnt)
from (
  select g.film_id, tk.framework, count(*)::int as cnt
  from public.takes tk join public.figures g on g.id=tk.figure_id
  where g.film_id = any({film_ids_array}) and tk.status='published' and tk.framework is not null and tk.framework<>'INVITATION'
  group by g.film_id, tk.framework
) tk
join public.films b on b.id=tk.film_id
on conflict do nothing;
-- @@split
-- N_question — a lens hook question
insert into public.film_sentences (film_id, pattern, sentence, take_id, theorist_id, theorist_name, concept, figure_id, salience, nums)
select b.id, 'N_question',
  format('%s (%s) — what does %s unlock in it?', b.title, b.year, tk.theorist_name),
  tk.id, tk.theorist_id, tk.theorist_name, tk.concept, g.id,
  8,
  jsonb_build_object('q','lens','strength',coalesce(tk.strength,5))
from public.takes tk
join public.figures g on g.id=tk.figure_id
join public.films b on b.id=g.film_id
where g.film_id = any({film_ids_array}) and tk.status='published'
  and tk.theorist_name is not null and tk.strength = (
    select max(t2.strength) from public.takes t2 join public.figures g2 on g2.id=t2.figure_id
    where g2.film_id=b.id and t2.status='published' and t2.theorist_name is not null)
on conflict do nothing;
-- @@split
-- J_location — confirmed filming location (layer='filmed')
insert into public.film_sentences (film_id, pattern, sentence, location_id, salience, nums)
select b.id, 'J_location',
  format('%s (%s) was filmed at %s%s.', b.title, b.year, l.name,
    case when l.country is not null then ', '||l.country else '' end),
  l.id,
  case when l.tier='verified' then 40 when l.tier='probable' then 28 else 20 end,
  jsonb_build_object('kind',l.kind,'tier',l.tier,'country',l.country,'confidence',l.confidence)
from public.film_locations l
join public.films b on b.id=l.film_id
where l.film_id = any({film_ids_array}) and l.layer='filmed' and l.name is not null
on conflict do nothing;
