-- 0022 — sequential "Prev · Index · Next" navigation, adapted per page type.
-- meta_take → siblings within its theory family; figure → within its film;
-- film → within its director's filmography. Returns up to 3 rows (prev/index/next).
create or replace function public.seq_nav(p_kind text, p_id uuid)
returns table(rel text, target text, slug text, film_slug text, title text)
language plpgsql stable as $$
begin
  if p_kind = 'meta_take' then
    if (select theory_family_id from meta_takes where id = p_id) is null then
      return query select 'index'::text, 'metaindex'::text, null::text, null::text, 'All meta takes'::text;
      return;
    end if;
    return query
    with sibs as (
      select m.slug, m.title,
        lag(m.slug)  over w as prev_slug, lag(m.title)  over w as prev_title,
        lead(m.slug) over w as next_slug, lead(m.title) over w as next_title
      from meta_takes m
      where m.status = 'published'
        and m.theory_family_id = (select theory_family_id from meta_takes where id = p_id)
      window w as (order by m.title)
    ), cur as (select * from sibs where slug = (select slug from meta_takes where id = p_id))
    select 'prev'::text, 'meta_take'::text, prev_slug, null::text, prev_title from cur where prev_slug is not null
    union all
    select 'index', 'family', tf.slug, null, tf.name from theory_families tf
      where tf.id = (select theory_family_id from meta_takes where id = p_id)
    union all
    select 'next', 'meta_take', next_slug, null, next_title from cur where next_slug is not null;
    return;
  end if;

  if p_kind = 'figure' then
    return query
    with f0 as (select film_id from figures where id = p_id),
    flm as (select slug, title from films where id = (select film_id from f0)),
    sibs as (
      select fig.slug, fig.label,
        lag(fig.slug)  over w as prev_slug, lag(fig.label)  over w as prev_label,
        lead(fig.slug) over w as next_slug, lead(fig.label) over w as next_label
      from figures fig
      where fig.film_id = (select film_id from f0) and fig.status = 'approved' and fig.slug is not null
      window w as (order by fig.label)
    ), cur as (select * from sibs where slug = (select slug from figures where id = p_id))
    select 'prev'::text, 'figure'::text, prev_slug, (select slug from flm), prev_label from cur where prev_slug is not null
    union all
    select 'index', 'film', (select slug from flm), null, (select title from flm)
    union all
    select 'next', 'figure', next_slug, (select slug from flm), next_label from cur where next_slug is not null;
    return;
  end if;

  if p_kind = 'film' then
    if (select director_slug from films where id = p_id) is null then
      return query select 'index'::text, 'filmindex'::text, null::text, null::text, 'All films'::text;
      return;
    end if;
    return query
    with sibs as (
      select fl.slug, fl.title,
        lag(fl.slug)  over w as prev_slug, lag(fl.title)  over w as prev_title,
        lead(fl.slug) over w as next_slug, lead(fl.title) over w as next_title
      from films fl
      where fl.director_slug = (select director_slug from films where id = p_id) and fl.slug is not null
      window w as (order by fl.year nulls last, fl.title)
    ), cur as (select * from sibs where slug = (select slug from films where id = p_id))
    select 'prev'::text, 'film'::text, prev_slug, null::text, prev_title from cur where prev_slug is not null
    union all
    select 'index', 'director', (select director_slug from films where id = p_id), null,
           (select director from films where id = p_id)
    union all
    select 'next', 'film', next_slug, null, next_title from cur where next_slug is not null;
    return;
  end if;
end;
$$;
grant execute on function public.seq_nav(text, uuid) to anon, authenticated;
