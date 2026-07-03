-- 0032 — Atlas 대륙매핑 DB화 (ROOM-HANDOVER-MASTER §8 P1-9 잔여, LOGIC-AUDIT §2.6/§4)
-- 프론트 하드코딩 사전(COUNTRY_CONT)이 사전에 없는 국가를 조용히 누락 → 블라인드가 데이터가 아닌
-- 사전 공백을 반영하던 결함 해소. film_locations에 실제 등장하는 전 국가(156)를 참조테이블로 커밋하고
-- me_geo_coverage가 continent와 실측 분모(countries_total)를 함께 반환한다.

create table if not exists public.country_continents (
  country   text primary key,
  continent text not null check (continent in ('Asia','Europe','Africa','N.America','S.America','Oceania','Other'))
);

insert into public.country_continents (country, continent) values
  -- Asia
  ('Afghanistan','Asia'),('Armenia','Asia'),('Azerbaijan','Asia'),('Bangladesh','Asia'),('Cambodia','Asia'),
  ('China','Asia'),('Georgia','Asia'),('Hong Kong','Asia'),('India','Asia'),('Indonesia','Asia'),
  ('Iran','Asia'),('Iraq','Asia'),('Israel','Asia'),('Japan','Asia'),('Jordan','Asia'),
  ('Kazakhstan','Asia'),('Korea','Asia'),('Kuwait','Asia'),('Kyrgyzstan','Asia'),('Laos','Asia'),
  ('Lebanon','Asia'),('Macao','Asia'),('Macau','Asia'),('Malaysia','Asia'),('Maldives','Asia'),
  ('Myanmar','Asia'),('Myanmar (Burma)','Asia'),('Nepal','Asia'),('Oman','Asia'),('Pakistan','Asia'),
  ('Palestine','Asia'),('Palestinian Territory','Asia'),('Philippines','Asia'),('Saudi Arabia','Asia'),
  ('Singapore','Asia'),('South Korea','Asia'),('Southeast Asia','Asia'),('Sri Lanka','Asia'),('Syria','Asia'),
  ('Taiwan','Asia'),('Thailand','Asia'),('Turkey','Asia'),('Türkiye','Asia'),('United Arab Emirates','Asia'),
  ('Uzbekistan','Asia'),('Vietnam','Asia'),
  -- Europe
  ('Albania','Europe'),('Austria','Europe'),('Belarus','Europe'),('Belgium','Europe'),
  ('Bosnia and Herzegovina','Europe'),('Bulgaria','Europe'),('Croatia','Europe'),('Czech Republic','Europe'),
  ('Czechia','Europe'),('Denmark','Europe'),('Estonia','Europe'),('Faroe Islands','Europe'),
  ('Finland','Europe'),('France','Europe'),('Germany','Europe'),('Greece','Europe'),('Guernsey','Europe'),
  ('Hungary','Europe'),('Iceland','Europe'),('Ireland','Europe'),('Italy','Europe'),('Latvia','Europe'),
  ('Lithuania','Europe'),('Luxembourg','Europe'),('Malta','Europe'),('Monaco','Europe'),
  ('Montenegro','Europe'),('Netherlands','Europe'),('North Macedonia','Europe'),('Norway','Europe'),
  ('Poland','Europe'),('Portugal','Europe'),('Romania','Europe'),('Russia','Europe'),('Serbia','Europe'),
  ('Slovakia','Europe'),('Slovenia','Europe'),('Spain','Europe'),('Svalbard and Jan Mayen','Europe'),
  ('Sweden','Europe'),('Switzerland','Europe'),('Ukraine','Europe'),('United Kingdom','Europe'),
  ('Vatican City','Europe'),
  -- Africa
  ('Algeria','Africa'),('Benin','Africa'),('Burkina Faso','Africa'),('Cabo Verde','Africa'),
  ('Cameroon','Africa'),('Cape Verde','Africa'),('Chad','Africa'),('Côte d''Ivoire','Africa'),
  ('Democratic Republic of the Congo','Africa'),('Djibouti','Africa'),('Egypt','Africa'),
  ('Eritrea','Africa'),('Gabon','Africa'),('Ghana','Africa'),('Guinea-Bissau','Africa'),('Kenya','Africa'),
  ('Mali','Africa'),('Mauritania','Africa'),('Mauritius','Africa'),('Morocco','Africa'),
  ('Mozambique','Africa'),('Namibia','Africa'),('Nigeria','Africa'),('Republic of the Congo','Africa'),
  ('Rwanda','Africa'),('Senegal','Africa'),('Seychelles','Africa'),('South Africa','Africa'),
  ('Tanzania','Africa'),('Tunisia','Africa'),('Uganda','Africa'),('Western Sahara','Africa'),
  ('Zambia','Africa'),('Zimbabwe','Africa'),
  -- North & Central America + Caribbean
  ('Bahamas','N.America'),('Canada','N.America'),('Central America','N.America'),('Costa Rica','N.America'),
  ('Cuba','N.America'),('Curaçao','N.America'),('Dominica','N.America'),('Dominican Republic','N.America'),
  ('Guadeloupe','N.America'),('Guatemala','N.America'),('Jamaica','N.America'),('Mexico','N.America'),
  ('Panama','N.America'),('Puerto Rico','N.America'),('Saint Lucia','N.America'),
  ('Saint Vincent and the Grenadines','N.America'),('The Bahamas','N.America'),
  ('Trinidad and Tobago','N.America'),('U.S. Virgin Islands','N.America'),('United States','N.America'),
  -- South America
  ('Argentina','S.America'),('Brazil','S.America'),('Chile','S.America'),('Colombia','S.America'),
  ('Ecuador','S.America'),('Paraguay','S.America'),('Peru','S.America'),('Uruguay','S.America'),
  ('Venezuela','S.America'),
  -- Oceania
  ('Australia','Oceania'),('Cook Islands','Oceania'),('Fiji','Oceania'),('French Polynesia','Oceania'),
  ('New Zealand','Oceania'),('Pitcairn Islands','Oceania'),('Samoa','Oceania'),('Solomon Islands','Oceania'),
  ('United States Minor Outlying Islands','Oceania'),
  -- Other / polar
  ('Antarctica','Other')
on conflict (country) do update set continent = excluded.continent;

-- 공개 참조 데이터 — 읽기 전용 공개 (개인정보 없음)
alter table public.country_continents enable row level security;
drop policy if exists country_continents_read_all on public.country_continents;
create policy country_continents_read_all on public.country_continents for select using (true);

-- me_geo_coverage v2 — by_country에 continent, totals에 실측 분모 추가 (json additive, 반환형 불변)
create or replace function public.me_geo_coverage()
returns json
language sql stable security definer
set search_path = public
as $$
  with mine as (
    select fl.film_id, fl.layer, fl.name, fl.narrative_setting, fl.kind,
           fl.lat, fl.lng, fl.country, f.slug, f.title
    from film_locations fl
    join user_movies um on um.film_id = fl.film_id
    join films f on f.id = fl.film_id
    where um.user_id = auth.uid()
      and um.seen = true
      and fl.lat is not null
      and fl.lng is not null
  ),
  pts as (
    select json_agg(json_build_object(
      'slug', slug, 'title', title, 'lat', lat, 'lng', lng,
      'country', country, 'name', name, 'narrative_setting', narrative_setting,
      'layer', coalesce(layer,'setting'), 'kind', kind
    ) order by title) as arr
    from mine
  ),
  by_country as (
    select json_agg(json_build_object(
      'country', country, 'films', films, 'pins', pins, 'continent', continent
    ) order by films desc, pins desc) as arr
    from (
      select coalesce(m.country,'미상') as country,
             count(distinct m.film_id) as films,
             count(*) as pins,
             cc.continent
      from mine m
      left join country_continents cc on cc.country = m.country
      group by coalesce(m.country,'미상'), cc.continent
    ) g
  ),
  totals as (
    select json_build_object(
      'located_films', (select count(distinct film_id) from mine),
      'total_watched', (select count(*) from user_movies um where um.user_id = auth.uid() and um.seen = true),
      'countries', (select count(distinct country) from mine where country is not null),
      'total_pins', (select count(*) from mine),
      'countries_total', (select count(distinct fl2.country) from film_locations fl2
                          where fl2.lat is not null and fl2.country is not null)
    ) as obj
  )
  select json_build_object(
    'points', coalesce((select arr from pts), '[]'::json),
    'by_country', coalesce((select arr from by_country), '[]'::json),
    'totals', (select obj from totals)
  );
$$;
