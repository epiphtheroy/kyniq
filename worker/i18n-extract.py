#!/usr/bin/env python3
"""i18n-extract — pull the Korean-localization work corpora out of production into JSON files.

Read-only. Writes data/i18n/src2/<corpus>.json as arrays of:
  { entity_type, entity_key, field, en, sha256, meta:{...} }

Re-polish corpora additionally carry `ko` (the 2026-07-17 translation being rewritten).

  python3 worker/i18n-extract.py --corpus all
  python3 worker/i18n-extract.py --corpus tow --limit 50
"""
import os, sys, json, hashlib, argparse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "data", "i18n", "src2")
PROJECT = "jvgarcqrtsmgfimdcwgo"

for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def q(sql):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        method="POST", data=json.dumps({"query": sql}).encode())
    req.add_header("Authorization", f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "metatake-worker/1.0 (supabase management api client)")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:600], file=sys.stderr)
        raise


def sha(s):
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


# entity_type, field, and the SQL that yields (entity_key, en[, ko][, meta...])
CORPORA = {
    # ── new translation ────────────────────────────────────────────────
    "tow": dict(entity_type="tow_comment", field="rationale", sql="""
        select f.slug as entity_key, fc.rationale as en,
               cf.director as director, f.title as title, f.year as year
        from public.films f
        join curation.film_comment fc on fc.tmdb_id = f.tmdb_id
        join curation.film cf on cf.tmdb_id = f.tmdb_id
        where fc.rationale is not null and length(fc.rationale) > 0
        order by f.slug"""),

    "portrait": dict(entity_type="director_portrait", field="body", sql="""
        select p.director_slug as entity_key, p.body as en, d.name as director
        from public.director_portrait p
        left join public.directors d on d.slug = p.director_slug
        where p.body is not null and length(p.body) > 0
        order by p.director_slug"""),

    "dfacts_intro": dict(entity_type="director_fact", field="intro", sql="""
        select df.director_slug as entity_key, df.intro as en, d.name as director
        from public.director_facts df
        left join public.directors d on d.slug = df.director_slug
        where df.intro is not null and length(df.intro) > 0
        order by df.director_slug"""),

    "dfacts_meaning": dict(entity_type="director_fact", field="name_meaning", sql="""
        select df.director_slug as entity_key, df.name_meaning as en, d.name as director
        from public.director_facts df
        left join public.directors d on d.slug = df.director_slug
        where df.name_meaning is not null and length(df.name_meaning) > 0
        order by df.director_slug"""),

    # Each fact is its own item: entity_key = "<director_slug>#<n>" so a single
    # bad fact can be re-queued without re-translating the whole array.
    "dfacts_items": dict(entity_type="director_fact", field="fact", sql="""
        select df.director_slug || '#' || (x->>'n') as entity_key,
               x->>'text' as en, d.name as director
        from public.director_facts df
        cross join lateral jsonb_array_elements(df.facts) as x
        left join public.directors d on d.slug = df.director_slug
        where x->>'text' is not null and length(x->>'text') > 0
        order by df.director_slug, (x->>'n')::int"""),

    # The Selection's "why start here" note. entity_key = "<director_slug>#<pos>"
    # rather than the film slug: the same film can be a pick for two directors,
    # and the reason is written about THAT director's path through it.
    # Keyed on the FILM, not the position. Three directors (Ozon, Kieślowski,
    # Almodóvar) carry two complete pick sets each — same pos, different films —
    # so "<slug>#<pos>" collided and one reason overwrote the other. Verified
    # unique: 1,033 rows, 1,033 distinct (director_slug, film_slug).
    "picks": dict(entity_type="director_pick", field="reason", sql="""
        select p.director_slug || '#' || p.film_slug as entity_key,
               p.reason as en, d.name as director,
               p.film_title as title, p.film_year as year
        from public.director_picks p
        left join public.directors d on d.slug = p.director_slug
        where p.reason is not null and length(p.reason) > 0
        order by p.director_slug, p.pos"""),

    # ── the invitation layer's untranslated tail ───────────────────────
    # Both corpora write the SAME key the app already reads —
    # `invitation|<film-slug>|rationale` — because the film and tonight routes
    # ask for one key per film and take whichever English prose they chose.
    #
    # The guard is the SOURCE HASH, not mere absence: it catches the rows that
    # were never translated AND the ones whose English has since been rewritten.
    # That matters here — a Tier-2 film promoted to a real take keeps its old
    # lead's Korean under the same key until the hash stops matching.

    # film_leads (migration 0140): the Tier-2 invitation. 5,002 of them were
    # written in August, AFTER the Korean run — so this prose had never been
    # offered to the translator at all, and the app read the English through.
    "leads": dict(entity_type="invitation", field="rationale", sql="""
        select f.slug as entity_key, l.lead as en,
               f.title as title, f.year as year, f.director as director
        from public.film_leads l
        join public.films f on f.id = l.film_id
        where l.lead is not null and length(l.lead) > 0
          and not exists (
            select 1 from public.content_i18n c
            where c.entity_type = 'invitation' and c.field = 'rationale'
              and c.lang = 'ko' and c.entity_key = f.slug
              and c.source_sha256 = encode(sha256(convert_to(l.lead, 'UTF8')), 'hex'))
        order by f.slug"""),

    # Take invitations with no Korean row yet — the tail `repolish_invitation`
    # cannot see, because that corpus starts FROM content_i18n and these have
    # never been in it.
    "invitation_new": dict(entity_type="invitation", field="rationale", sql="""
        select t.slug as entity_key, t.en as en, t.title as title,
               t.year as year, t.director as director
        from (
          select f.slug, f.title, f.year, f.director,
                 (select tk.rationale
                    from public.takes tk
                    join public.figures fg on fg.id = tk.figure_id
                   where fg.film_id = f.id and tk.is_invitation
                     and tk.status = 'published' and tk.rationale is not null
                   order by tk.id limit 1) as en
          from public.films f
        ) t
        where t.en is not null and length(t.en) > 0
          and not exists (
            select 1 from public.content_i18n c
            where c.entity_type = 'invitation' and c.field = 'rationale'
              and c.lang = 'ko' and c.entity_key = t.slug
              and c.source_sha256 = encode(sha256(convert_to(t.en, 'UTF8')), 'hex'))
        order by t.slug"""),

    # ── re-polish (R1): existing ko rewritten in the new voice ─────────
    "repolish_invitation": dict(entity_type="invitation", field="rationale", sql="""
        select c.entity_key, t.rationale as en, c.text as ko, f.title as title
        from public.content_i18n c
        join public.films f on f.slug = c.entity_key
        join lateral (
          select tk.rationale
          from public.takes tk
          join public.figures fg on fg.id = tk.figure_id
          where fg.film_id = f.id and tk.is_invitation and tk.status = 'published'
            and tk.rationale is not null
          order by tk.id limit 1
        ) t on true
        where c.entity_type = 'invitation' and c.field = 'rationale' and c.lang = 'ko'
        order by c.entity_key"""),

    "repolish_laconic": dict(entity_type="trope", field="laconic", sql="""
        select c.entity_key, m.laconic as en, c.text as ko, m.title as title
        from public.content_i18n c
        join public.meta_takes m on m.slug = c.entity_key
        where c.entity_type = 'trope' and c.field = 'laconic' and c.lang = 'ko'
          and m.laconic is not null
        order by c.entity_key"""),

    "repolish_trope_title": dict(entity_type="trope", field="title", sql="""
        select c.entity_key, m.title as en, c.text as ko
        from public.content_i18n c
        join public.meta_takes m on m.slug = c.entity_key
        where c.entity_type = 'trope' and c.field = 'title' and c.lang = 'ko'
          and m.title is not null
        order by c.entity_key"""),
}

RESERVED = {"entity_key", "en", "ko"}


def extract(name, limit=None, page=400):
    """Paginated — the Management API rejects multi-MB responses (HTTP 400)."""
    spec = CORPORA[name]
    rows, offset = [], 0
    while True:
        take = page if limit is None else min(page, limit - len(rows))
        if take <= 0:
            break
        batch = q(spec["sql"] + f"\n limit {take} offset {offset}")
        rows.extend(batch)
        offset += take
        if len(batch) < take:
            break
    items = []
    for r in rows:
        en = r.get("en") or ""
        item = {
            "entity_type": spec["entity_type"],
            "entity_key": r["entity_key"],
            "field": spec["field"],
            "en": en,
            "sha256": sha(en),
        }
        if r.get("ko"):
            item["ko"] = r["ko"]
        meta = {k: v for k, v in r.items() if k not in RESERVED and v is not None}
        if meta:
            item["meta"] = meta
        items.append(item)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    chars = sum(len(i["en"]) for i in items)
    print(f"{name:22s} rows={len(items):6d}  en_chars={chars:10,d}  -> {os.path.relpath(path, ROOT)}")
    return items


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="all")
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args()
    names = list(CORPORA) if a.corpus == "all" else a.corpus.split(",")
    for n in names:
        extract(n, a.limit)
