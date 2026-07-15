#!/usr/bin/env python3
"""Read crm-handoff/contacts.json → emit batch SQL files for Supabase execute_sql.
Each file is a complete, re-run-safe INSERT (400 rows/batch) using jsonb_to_recordset.
Output: crm-handoff/_batches/batch_NNN.sql  (⚠️ contains personal emails — gitignored)

Usage:  python3 crm-handoff/scripts/parse_contacts.py   # first
        python3 crm-handoff/scripts/emit_batches.py
Then run each batch_NNN.sql via Supabase MCP execute_sql (project jvgarcqrtsmgfimdcwgo).
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "crm-handoff" / "contacts.json"
OUTDIR = REPO / "crm-handoff" / "_batches"
BATCH = 400

KEYS = ["name","org_name","role_title","country","jurisdiction","kr_law_flag",
        "email","alt_emails","channel_type","contact_url","source_url","collected_at","legal_basis","segment_code"]

HEAD = """insert into crm_contacts (name, org_name, role_title, country, jurisdiction, kr_law_flag,
  email, alt_emails, channel_type, contact_url, source_url, collected_at, legal_basis, segment_code)
select nullif(x.name,''), x.org_name, nullif(x.role_title,''), nullif(x.country,''),
       coalesce(nullif(x.jurisdiction,''),'OTHER'), coalesce(x.kr_law_flag,false),
       nullif(lower(x.email),''), coalesce(x.alt_emails,'{}'::text[]), coalesce(nullif(x.channel_type,''),'email'),
       nullif(x.contact_url,''), nullif(x.source_url,''), x.collected_at, nullif(x.legal_basis,''), x.segment_code
from jsonb_to_recordset(%s::jsonb) as x(
  name text, org_name text, role_title text, country text, jurisdiction text, kr_law_flag boolean,
  email text, alt_emails text[], channel_type text, contact_url text, source_url text,
  collected_at date, legal_basis text, segment_code text)
where x.org_name is not null
  and (x.email is null or not exists (select 1 from crm_contacts c where lower(c.email)=lower(x.email)));"""

def sql_lit(js: str) -> str:
    return "'" + js.replace("'", "''") + "'"

def main():
    rows = json.loads(SRC.read_text())
    OUTDIR.mkdir(parents=True, exist_ok=True)
    for f in OUTDIR.glob("batch_*.sql"): f.unlink()
    n = 0
    for i in range(0, len(rows), BATCH):
        n += 1
        chunk = [{k: r.get(k) for k in KEYS} for r in rows[i:i+BATCH]]
        js = json.dumps(chunk, ensure_ascii=False)
        (OUTDIR / f"batch_{n:03d}.sql").write_text(HEAD % sql_lit(js))
    print(f"{len(rows)} rows → {n} batch files in {OUTDIR}")
    print("Run each via Supabase MCP execute_sql, then verify: select count(*) from crm_contacts;")

if __name__ == "__main__":
    main()
