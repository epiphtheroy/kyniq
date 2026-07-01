#!/usr/bin/env python3
"""Emit a safe, dollar-quoted DELETE+INSERT for a parsed blog draft.

Reuses blog-parse output, injects film year/backdrop from a --meta map, and prints
SQL ready to run via the Supabase MCP execute_sql. Dollar-quoting avoids all escaping.
NO network. Caller supplies verified film year/backdrop (and must have checked links).

Usage:
  python3 worker/blog-emit-sql.py --date 2026-06-24 \
     --meta '{"rashomon-1950":[1950,"/x.jpg"], ...}'
"""
import os, sys, re, json, glob, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
def argval(flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None

# get parsed JSON from blog-parse.py
date = argval("--date"); fpath = argval("--file")
cmd = [sys.executable, os.path.join(HERE, "blog-parse.py")]
cmd += (["--file", fpath] if fpath else ["--date", date])
parsed = json.loads(subprocess.check_output(cmd).decode())
meta = json.loads(argval("--meta") or "{}")

for e in parsed["entries"]:
    m = meta.get(e["film_slug"])
    if m:
        e["film_year"] = m[0]; e["bd"] = m[1]

# --drop-links: strip dead internal <a> anchors (keep inner text), e.g. retired tropes
drop = [h for h in (argval("--drop-links") or "").split(",") if h.strip()]
if drop:
    def strip_dead(html):
        if not html: return html
        for href in drop:
            html = re.sub(r"<a class='lk-in' href='" + re.escape(href.strip()) + r"'>(.*?)</a>", r"\1", html)
        return html
    for e in parsed["entries"]:
        for k in ("news", "read", "deposit"):
            e[k] = strip_dead(e[k])
    for fl in parsed["floor"]:
        fl["html"] = strip_dead(fl["html"])

def dq(s, tag):
    return f"${tag}$" + (s if s is not None else "") + f"${tag}$"

slug = parsed["slug"]
entries_json = json.dumps(parsed["entries"], ensure_ascii=False)
floor_json = json.dumps(parsed["floor"], ensure_ascii=False)
sql = (
    f"delete from posts where slug = {dq(slug,'sl')};\n"
    "insert into posts (slug, title, edition_date, dek, read_min, status, intro, entries, floor) values (\n"
    f"  {dq(slug,'sl')}, $t$Between Film and the World$t$, {dq(slug,'ed')}::date,\n"
    f"  {dq(parsed['dek'],'dek')}, {parsed['read_min']}, $st$published$st$,\n"
    f"  {dq(parsed['intro'],'intro')},\n"
    f"  {dq(entries_json,'ent')}::jsonb,\n"
    f"  {dq(floor_json,'flr')}::jsonb\n"
    ");"
)
print(sql)
