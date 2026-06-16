-- 0021 — random content surfacing (homepage showcase + random buttons)

-- One random published reading (take) with everything needed to render a card.
create or replace function public.random_reading()
returns table(take_id uuid, rationale text, register text,
  figure_label text, figure_slug text, film_title text, film_slug text,
  mt_title text, mt_slug text)
language sql stable as $$
  select t.id, t.rationale, t.register, fig.label, fig.slug, f.title, f.slug, m.title, m.slug
  from takes t
  join figures fig on fig.id = t.figure_id and fig.slug is not null
  join films f on f.id = fig.film_id
  left join meta_takes m on m.id = t.meta_take_id and m.status = 'published'
  where t.status = 'published' and t.rationale is not null and length(t.rationale) > 40
  order by random() limit 1;
$$;

-- A random film that actually has content (an approved, linkable figure).
create or replace function public.random_film_slug()
returns text language sql stable as $$
  select f.slug from films f
  where f.slug is not null
    and exists (select 1 from figures fig where fig.film_id = f.id and fig.status = 'approved' and fig.slug is not null)
  order by random() limit 1;
$$;

create or replace function public.random_meta_take_slug()
returns text language sql stable as $$
  select slug from meta_takes where status = 'published' order by random() limit 1;
$$;

-- A random individual take's location, so /random/take can jump to it on its figure page.
create or replace function public.random_take_loc()
returns table(film_slug text, figure_slug text, take_id uuid)
language sql stable as $$
  select f.slug, fig.slug, t.id
  from takes t
  join figures fig on fig.id = t.figure_id and fig.slug is not null
  join films f on f.id = fig.film_id
  where t.status = 'published'
  order by random() limit 1;
$$;

grant execute on function public.random_reading() to anon, authenticated;
grant execute on function public.random_film_slug() to anon, authenticated;
grant execute on function public.random_meta_take_slug() to anon, authenticated;
grant execute on function public.random_take_loc() to anon, authenticated;
