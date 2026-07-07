"""figure SEO 생성 공용: 프롬프트/스키마/검수 규칙"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODEL = "claude-opus-4-8"

SYSTEM = """You write search-facing metadata for Metatake (metatake.net), a film-interpretation site. Each input describes a "figure" — a meaningful object, scene, character, or motif in one film — plus titles of critical readings attached to it.

Return JSON with exactly two fields:

1. "q_title" — ONE natural English question a curious viewer would actually type into Google about this figure.
   - Read like a real search query ("Why does…", "What does … mean in …?", "Who is…", "What is the significance of…"); end with "?".
   - Include the film's title naturally.
   - Aim for 35–80 characters; never exceed 95.
   - Spoiler-safe: never state or presuppose deaths, twists, betrayals, or late-film reveals in the question itself. Asking what an ending or a reveal MEANS is fine; stating what happens in it is not. If the figure is itself a late-film reveal, ask about meaning at a safe altitude.
   - Specific to THIS figure, not a generic question about the film.
2. "short_label" — a compact noun phrase naming the figure for section headings. 2–5 words, ≤ 40 characters, sentence case (capitalize only the first word and proper nouns), no film title, no trailing period.

Write for humans; no keyword stuffing; American English."""

SCHEMA = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {"q_title": {"type": "string"}, "short_label": {"type": "string"}},
        "required": ["q_title", "short_label"],
        "additionalProperties": False,
    },
}

def user_msg(row):
    lines = [
        f"Film: {row['film_title']} ({row['film_year'] or 'year unknown'})",
        f"Figure kind: {row['kind'] or 'motif'}",
        f"Figure: {row['label']}",
    ]
    if row.get("description"):
        lines.append(f"Description: {row['description']}")
    if row.get("takes"):
        lines.append("Readings attached: " + " / ".join(row["takes"]))
    if row.get("spoiler_level"):
        lines.append(f"Note: this figure is flagged spoiler level '{row['spoiler_level']}' — keep the question especially spoiler-safe.")
    return "\n".join(lines)

SPOILER_RE = re.compile(r"\b(dies|died|death of|kills?|killed|murders?|murdered|suicide|is dead|betrays?|turns out to be|revealed to be|twist(?:\s+is)?\b)", re.I)

def title_tokens(film_title):
    return [w for w in re.findall(r"[A-Za-z0-9']+", film_title) if len(w) > 3 and w.lower() not in ("the", "with", "from", "into")]

def qa_row(row, out):
    """returns list of problems (empty = pass)"""
    probs = []
    q = (out.get("q_title") or "").strip()
    s = (out.get("short_label") or "").strip()
    if not q.endswith("?"): probs.append("no-question-mark")
    if not (20 <= len(q) <= 95): probs.append(f"q-len-{len(q)}")
    ft = row["film_title"]
    toks = title_tokens(ft)
    if ft.lower() not in q.lower() and not any(t.lower() in q.lower() for t in toks):
        probs.append("film-title-missing")
    if SPOILER_RE.search(q): probs.append("spoiler-pattern")
    if not s or len(s) > 45: probs.append(f"label-len-{len(s)}")
    if len(s.split()) > 6: probs.append("label-too-many-words")
    if s.endswith("."): probs.append("label-trailing-period")
    return probs

def anthropic_key():
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith("ANTHROPIC_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("no ANTHROPIC_API_KEY")

def load_input():
    rows = []
    with open(pathlib.Path(__file__).resolve().parent / "figures_input.jsonl") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows
