-- 0039 (P1): director dedup, mislink repair, slug repair — 2026-07-06.
-- Root causes fixed in code the same day:
--   (a) diacritic-dropping slugify in app/api/admin/films/import/route.ts minted
--       slugs like "aki-kaurism-ki" / "ric-toledano" alongside the correct
--       deaccented ones → duplicate director entries on /director;
--   (b) co-director ingest (worker/tmdb-fetch.py) upserted the *other* credited
--       director's TMDB person into the row keyed by films.director_slug
--       (e.g. slug "diethard-kuster" holding Andrei Tarkovsky's data).
-- Lossless: merges are UPDATE-rewires + slug_aliases rows (308 via resolveAlias);
-- nothing is deleted. Guarded updates never clobber an existing target row.
-- Apply ONLY after the /director/[slug] resolveAlias fallback is deployed.

-- Canonical slug map: films.director_slug old → new (dup merges, broken-slug
-- renames, and the basel-adra → rachel-szor mispointed group).
create temp table _dmap(old_slug text primary key, new_slug text not null);
insert into _dmap(old_slug, new_slug) values
  ('aki-kaurism-ki','aki-kaurismaki'),
  ('alejandro-gonz-lez-i-rritu','alejandro-gonzalez-inarritu'),
  ('diethard-kuster','andrei-tarkovsky'),
  ('c-line-sciamma','celine-sciamma'),
  ('chlo-zhao','chloe-zhao'),
  ('fran-ois-ozon','francois-ozon'),
  ('kleber-mendon-a-filho','kleber-mendonca-filho'),
  ('krzysztof-kie-lowski','krzysztof-kieslowski'),
  ('milo-forman','milos-forman'),
  ('pedro-almod-var','pedro-almodovar'),
  ('ruben-stlund','ruben-ostlund'),
  ('ry-suke-hamaguchi','ryusuke-hamaguchi'),
  ('sebasti-n-lelio','sebastian-lelio'),
  ('sh-hei-imamura','shohei-imamura'),
  ('alejandro-amen-bar','alejandro-amenabar'),
  ('alfonso-cuar-n','alfonso-cuaron'),
  ('c-lin-peter-netzer','calin-peter-netzer'),
  ('dami-n-szifron','damian-szifron'),
  ('jean-marc-vall-e','jean-marc-vallee'),
  ('juan-jos-campanella','juan-jose-campanella'),
  ('karim-a-nouz','karim-ainouz'),
  ('l-szl-nemes','laszlo-nemes'),
  ('m-lanie-laurent','melanie-laurent'),
  ('pawe-pawlikowski','pawel-pawlikowski'),
  ('ric-toledano','eric-toledano'),
  ('basel-adra','rachel-szor');

-- 1) films → canonical slugs; plus the single mispointed film (Persona 1966
--    carried John Huston's slug — both directors are real, so no alias here).
update films f set director_slug = m.new_slug from _dmap m where f.director_slug = m.old_slug;
update films set director_slug = 'ingmar-bergman' where slug = 'persona-1966' and director_slug = 'john-huston';

-- 2) directors rows keyed by a broken form of their own slug → re-key (guarded).
update directors d set slug = m.new_slug from _dmap m
 where d.slug = m.old_slug
   and not exists (select 1 from directors t where t.slug = m.new_slug);

-- 3) directors rows holding a DIFFERENT person's data (co-director ingest
--    overwrite) → re-key to the person the row actually describes. The old
--    slug's page stays live (films still point there; name falls back to
--    films.director), so no alias rows for these.
create temp table _bmap(old_slug text primary key, new_slug text not null);
insert into _bmap(old_slug, new_slug) values
  ('aaron-horvath','michael-jelenic'),
  ('albert-maysles','ellen-giffard'),
  ('anna-boden','ryan-fleck'),
  ('ben-sharpsteen','hamilton-luske'),
  ('buster-keaton','clyde-bruckman'),
  ('danny-philippou','michael-philippou'),
  ('elizabeth-chai-vasarhelyi','jimmy-chin'),
  ('felix-van-groeningen','charlotte-vandermeersch'),
  ('hideaki-anno','shinji-higuchi'),
  ('james-algar','samuel-armstrong'),
  ('jared-bush','byron-howard'),
  ('jim-abrahams','jerry-zucker'),
  ('joaquim-dos-santos','justin-k-thompson'),
  ('julian-brave-noisecat','emily-kassie'),
  ('kleber-mendon-a-filho','juliano-dornelles'),
  ('maggie-kang','chris-appelhans'),
  ('michael-powell','emeric-pressburger'),
  ('nick-bruno','troy-quane'),
  ('stanley-donen','gene-kelly'),
  ('vincent-paronnaud','marjane-satrapi'),
  ('vittorio-de-sica','mario-monicelli'),
  ('waad-al-kateab','edward-watts');
update directors d set slug = m.new_slug from _bmap m
 where d.slug = m.old_slug
   and not exists (select 1 from directors t where t.slug = m.new_slug);

-- 4) rewire director_* reference tables to the canonical slugs
--    (PK-on-slug tables are guarded; conflicting old rows stay orphaned, unread).
update director_facts x set director_slug = m.new_slug from _dmap m
 where x.director_slug = m.old_slug
   and not exists (select 1 from director_facts t where t.director_slug = m.new_slug);
update director_portrait x set director_slug = m.new_slug from _dmap m
 where x.director_slug = m.old_slug
   and not exists (select 1 from director_portrait t where t.director_slug = m.new_slug);
update director_picks x set director_slug = m.new_slug from _dmap m where x.director_slug = m.old_slug;
update director_next  x set director_slug = m.new_slug from _dmap m where x.director_slug = m.old_slug;

-- 5) URL permanence ledger: every renamed/merged director path 308s to canonical.
insert into slug_aliases(old_path, new_path, reason)
select '/director/' || m.old_slug, '/director/' || m.new_slug,
       'P1 director slug repair: diacritic slug bug + co-director ingest mixups (2026-07-06)'
from _dmap m
on conflict (old_path) do nothing;

-- 6) unify films.director display text with the canonical directors row
--    (merged groups carried two spellings, e.g. "Aki Kaurismaki" / "Aki Kaurismäki").
update films f set director = d.name
from _dmap m join directors d on d.slug = m.new_slug
where f.director_slug = m.new_slug and f.director is distinct from d.name;

drop table _dmap;
drop table _bmap;
