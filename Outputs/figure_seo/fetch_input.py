#!/usr/bin/env python3
"""figure SEO 질문 생성용 입력 추출: approved figures + film 제목/연도 + 상위 take 제목 3개 → figures_input.jsonl"""
import json, os, sys, pathlib
import requests

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent

def env(name):
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"missing env {name}")

URL = env("NEXT_PUBLIC_SUPABASE_URL")
KEY = env("SUPABASE_SERVICE_ROLE_KEY")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

def fetch_all(table, select, extra=""):
    rows, offset = [], 0
    while True:
        r = requests.get(
            f"{URL}/rest/v1/{table}?select={select}{extra}",
            headers={**H, "Range": f"{offset}-{offset+999}", "Range-Unit": "items"},
            timeout=60,
        )
        r.raise_for_status()
        page = r.json()
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += 1000

figures = fetch_all("figures", "id,film_id,label,kind,description,spoiler_level,slug", "&status=eq.approved")
films = {f["id"]: f for f in fetch_all("films", "id,title,year")}
takes = fetch_all("takes", "figure_id,take_title,strength")

by_fig = {}
for t in takes:
    by_fig.setdefault(t["figure_id"], []).append(t)
for v in by_fig.values():
    v.sort(key=lambda t: (t["strength"] is None, -(t["strength"] or 0)))

n_nofilm = 0
with open(OUT / "figures_input.jsonl", "w") as f:
    for fig in figures:
        film = films.get(fig["film_id"])
        if not film:
            n_nofilm += 1
            continue
        desc = (fig["description"] or "").strip()
        f.write(json.dumps({
            "id": fig["id"],
            "slug": fig["slug"],
            "film_title": film["title"],
            "film_year": film["year"],
            "kind": fig["kind"],
            "label": (fig["label"] or "").strip(),
            "description": desc[:600],
            "spoiler_level": fig["spoiler_level"],
            "takes": [t["take_title"] for t in by_fig.get(fig["id"], [])[:3] if t["take_title"]],
        }, ensure_ascii=False) + "\n")

print(f"figures: {len(figures)}, films: {len(films)}, takes: {len(takes)}, skipped(no film): {n_nofilm}")
