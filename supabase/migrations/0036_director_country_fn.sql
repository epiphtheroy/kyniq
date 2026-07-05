-- 0036 (P2): director_country(place_of_birth) — normalized modern country from a
-- raw TMDB birthplace string, or NULL when unknown. Derivation, not storage:
-- place_of_birth stays untouched (lossless), so new ingests can never go stale.
--
-- Policy (applied consistently): the MODERN country wins. "[now X]" / "(now X)"
-- annotations resolve to X; defunct entities map to their successor state; city
-- birthplaces with ambiguous historical entities are pinned per-string below.
-- Hong Kong is kept as its own group (a distinct film tradition).

create or replace function public.director_country(pob text)
returns text
language sql
immutable
as $$
  with base as (select nullif(btrim(pob), '') as p),
  seg as (
    select case
      -- whole-string pins where the generic rules can't know better
      when p ilike '%hong kong%' then 'Hong Kong'
      when p = 'Sucha, Galicia, Austria-Hungary' then 'Poland'      -- Sucha Beskidzka
      when p = 'Wiznitz, Bukovina, Austria-Hungary' then 'Ukraine'  -- Vyzhnytsia
      when p = 'Riga, Russian Empire' then 'Latvia'
      when p = 'Oudenaarde, Flanders, Belgium, EU' then 'Belgium'
      -- trailing "[now …]" / "(now …)" / trailing parenthetical → the modern name inside
      when p ~ '\[now [^\]]+\]\s*$' then split_part(substring(p from '\[now ([^\]]+)\]\s*$'), ',', -1)
      when p ~ '\(now [^)]+\)\s*$' then split_part(substring(p from '\(now ([^)]+)\)\s*$'), ',', -1)
      when p ~ '\([^)]+\)\s*$' then split_part(substring(p from '\(([^)]+)\)\s*$'), ',', -1)
      else split_part(p, ',', -1)
    end as s
    from base where p is not null
  ),
  clean as (
    -- strip stray brackets, take the last " - "-separated chunk, squeeze spaces
    select btrim(regexp_replace(
             (regexp_split_to_array(regexp_replace(s, '[\[\]()]', '', 'g'), ' - '))[
               array_length(regexp_split_to_array(regexp_replace(s, '[\[\]()]', '', 'g'), ' - '), 1)]
           , '\s+', ' ', 'g')) as c
    from seg
  )
  select case
    when c is null or c = '' then null
    when c in ('USA','US','U.S.','U.S','United States of America','Florida','Teaneck New Jersey United States') then 'United States'
    when c in ('UK','England','Scotland','Wales','Northern Ireland','Birleşik Krallık','İngiltere') then 'United Kingdom'
    when c = 'Francia' then 'France'
    when c = 'España' then 'Spain'
    when c = 'Italia' then 'Italy'
    when c in ('Deutschland','Allemagne','West Germany','East Germany') then 'Germany'
    when c = 'Danmark' then 'Denmark'
    when c = 'Svezia' then 'Sweden'
    when c = 'Polska' then 'Poland'
    when c = 'Maroc' then 'Morocco'
    when c = 'Turchia' then 'Turkey'
    when c = 'Corea del Sur' then 'South Korea'
    when c = 'Trung Quốc' then 'China'
    when c in ('Lâm Đồng','Central Vietnam') then 'Vietnam'
    when c in ('Maharashtra','British India') then 'India'
    when c = 'Republic of Georgia' then 'Georgia'
    when c = 'Slovak Republic' then 'Slovakia'
    when c = 'Czechoslovakia' then 'Czech Republic'
    when c in ('USSR','Russian Empire','Soviet Union') then 'Russia'
    when c = 'Austria-Hungary' then null  -- successor unknowable from the string alone
    when c = 'German Reich' then 'Germany'
    else c
  end
  from clean;
$$;
