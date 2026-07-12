/**
 * /admin/factory — The Film Factory observation plane (§12).
 *
 * Reads the three public service-role wrapper RPCs (migration 0081) which
 * expose the PostgREST-unexposed `factory` schema as single-row jsonb
 * (1000-row cap never applies):
 *   factory_matrix_json(50)      → { runs[], intake[], stages[] }
 *   factory_gaps_json(30)        → { days, total_recent, deficits{}, sample[] }
 *   factory_change_orders_json() → change_order[]
 *
 * Writes are status-only mutations (execution stays on the Mac loop — the
 * execution plane is separated from this observation plane; §12/Ω): the
 * approve/reject and approve/dismiss buttons are Next.js server actions that
 * call factory_intake_decide(id,action) / factory_co_decide(id,action).
 *
 * Auth: middleware already gates every /admin/* route; we still call
 * getAdminUser() → notFound() to match the metrics page convention.
 */
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// ── jsonb shapes (from the wrapper RPCs) ──────────────────────────────────

interface RunRow {
  id: number;
  mode: string | null;
  film_count: number | null;
  est_cost_usd: number | null;
  actual_cost_usd: number | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
}
interface IntakeRow {
  id: number;
  source: string | null;
  raw_title: string | null;
  year_hint: number | null;
  tmdb_id: number | null;
  film_id: string | null;
  tier: string | null;
  status: string | null;
  confidence: string | null;
  resolve_note: string | null;
  run_id: number | null;
  created_at: string | null;
}
interface StageRow {
  run_id: number | null;
  film_id: string | null;
  stage_id: string | null;
  status: string | null;
  attempt: number | null;
  batch_id: string | null;
  cost_usd: number | null;
  error: string | null;
}
interface Matrix {
  runs: RunRow[];
  intake: IntakeRow[];
  stages: StageRow[];
}
interface Gaps {
  days: number;
  total_recent: number;
  deficits: Record<string, number>;
  sample: {
    slug: string; title: string; figs: number; visible: boolean;
    analyzed: boolean; hold: boolean; ts: boolean;
  }[];
}
interface ChangeOrder {
  id: number;
  kind: string | null;
  title: string | null;
  evidence: string | null;
  affected_stages: string[] | string | null;
  risk: string | null;
  status: string | null;
  created_at: string | null;
}

// ── server actions (status-only writes; NEVER fire execution) ─────────────

async function decideIntake(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const action = String(formData.get("action") || "");
  if (!Number.isFinite(id) || (action !== "approve" && action !== "reject")) return;
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();
  await supabase.rpc("factory_intake_decide", { p_id: id, p_action: action });
  revalidatePath("/admin/factory");
}

async function decideChangeOrder(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const action = String(formData.get("action") || "");
  if (!Number.isFinite(id) || (action !== "approve" && action !== "dismiss")) return;
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();
  await supabase.rpc("factory_co_decide", { p_id: id, p_action: action });
  revalidatePath("/admin/factory");
}

// Queue a run: creates factory.runs(status='queued') from eligible intake and links it.
// This is a STATUS write only — the Mac watcher (worker/factory-watch.sh) claims the
// queued run and executes the standalone executor. The admin never fires execution itself.
async function queueRun() {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const supabase = createAdminClient();
  await supabase.rpc("factory_queue_run");
  revalidatePath("/admin/factory");
}

// Forgiving one-film-per-line parser (mirrors worker/factory.py parse_film_lines):
//  • skip blank + '#' comment lines
//  • CSV mode when the first meaningful line is a `title,...` header — cols title,year,director,tmdb_id,tier
//  • else text mode: "Title (Year)" (year optional), plus optional `tmdb:12345` token and trailing `| 1999`
type ParsedFilm = { title: string; year: number | null; director: string | null; tmdb_id: number | null; tier: string | null };
function parseFilmLines(text: string): ParsedFilm[] {
  const lines = text.split(/\r?\n/);
  const firstMeaningful = lines.find((l) => l.trim() && !l.trim().startsWith("#"))?.trim() ?? "";
  const isCsv = /^title\s*,/i.test(firstMeaningful) || /^film_title\s*,/i.test(firstMeaningful);
  const out: ParsedFilm[] = [];
  let header: string[] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (isCsv) {
      const cells = line.split(",").map((c) => c.trim());
      if (!header) { header = cells.map((c) => c.toLowerCase()); continue; }
      const rec: Record<string, string> = {};
      header.forEach((h, i) => { rec[h] = cells[i] ?? ""; });
      const title = (rec["title"] || rec["film_title"] || "").trim();
      if (!title) continue;
      out.push({
        title,
        year: /^\d{4}$/.test(rec["year"] || "") ? Number(rec["year"]) : null,
        director: rec["director"] || null,
        tmdb_id: /^\d+$/.test(rec["tmdb_id"] || "") ? Number(rec["tmdb_id"]) : null,
        tier: rec["tier"] || null,
      });
    } else {
      let s = line;
      let tmdb: number | null = null;
      let year: number | null = null;
      // 1. explicit `tmdb:12345` token
      const mt = s.match(/\btmdb[:=](\d+)\b/i);
      if (mt) { tmdb = Number(mt[1]); s = (s.slice(0, mt.index) + s.slice((mt.index ?? 0) + mt[0].length)).trim(); }
      // 2. explicit year via `|` or `,` delimiter: "Title | 1999"
      const md = s.match(/^(.*\S)\s*[|,]\s*(\d{4})\s*$/);
      if (md && Number(md[2]) >= 1870 && Number(md[2]) <= 2035) { s = md[1].trim(); year = Number(md[2]); }
      // 3. bare trailing TMDB id — "Title 496243" (>=3 digits so "Toy Story 2" is safe)
      if (tmdb === null) {
        const mb = s.match(/^(.+?)\s+(\d{3,})$/);
        if (mb) { s = mb[1].trim(); tmdb = Number(mb[2]); }
      }
      // 4. year in parens: "Title (2019)"
      const mp = s.match(/^(.*?)\s*\((\d{4})\)\s*$/);
      if (mp) { s = mp[1].trim(); if (year === null) year = Number(mp[2]); }
      const title = s.trim();
      if (!title) continue;
      out.push({ title, year, director: null, tmdb_id: tmdb, tier: null });
    }
  }
  return out;
}

// Add films to intake: parse a pasted textarea (one title per line) and/or an uploaded
// .txt/.csv, insert all in one round-trip via factory_intake_add_batch (dedups repeats).
// STATUS write only — rows land 'queued' (or 'review' if tier=auto); the Mac loop executes them.
async function addFilms(formData: FormData) {
  "use server";
  const admin = await getAdminUser();
  if (!admin) return;
  const pasted = String(formData.get("titles") || "");
  const file = formData.get("file");
  const fromFile = file instanceof File && file.size > 0 ? await file.text() : "";
  const tierSel = String(formData.get("tier") || "full");
  const rows = [...parseFilmLines(pasted), ...parseFilmLines(fromFile)].map((r) => ({
    title: r.title,
    year: r.year,
    director: r.director,
    tmdb_id: r.tmdb_id,
    tier: r.tier || tierSel,
  }));
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  await supabase.rpc("factory_intake_add_batch", { p_source: "admin", p_rows: rows, p_requested_by: "admin" });
  revalidatePath("/admin/factory");
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function FactoryPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const supabase = createAdminClient();
  const [matrixRes, gapsRes, coRes] = await Promise.all([
    supabase.rpc("factory_matrix_json", { p_limit: 50 }),
    supabase.rpc("factory_gaps_json", { p_days: 30 }),
    supabase.rpc("factory_change_orders_json"),
  ]);

  if (matrixRes.error) {
    return <div style={{ color: "#e66767" }}>Failed to load factory matrix: {matrixRes.error.message}</div>;
  }

  const matrix = (matrixRes.data ?? { runs: [], intake: [], stages: [] }) as Matrix;
  const gaps = (gapsRes.data ?? null) as Gaps | null;
  const orders = (Array.isArray(coRes.data) ? coRes.data : []) as ChangeOrder[];

  const runs = matrix.runs ?? [];
  const intake = matrix.intake ?? [];
  const stages = matrix.stages ?? [];

  // R1 review queue = intake awaiting a human decision.
  const reviewQueue = intake.filter((i) => i.status === "review");
  // Pending intake = added, not yet linked to a run — this is exactly what "Queue a run" will pick up.
  const pendingIntake = intake.filter((i) => (i.status === "queued" || i.status === "approved") && !i.run_id);

  // Matrix: group stage_runs by film, count status per film, keep stage ids.
  const perFilm = new Map<string, { total: number; byStatus: Record<string, number> }>();
  for (const s of stages) {
    const key = s.film_id ?? "—";
    const e = perFilm.get(key) ?? { total: 0, byStatus: {} };
    e.total += 1;
    const st = s.status ?? "unknown";
    e.byStatus[st] = (e.byStatus[st] ?? 0) + 1;
    perFilm.set(key, e);
  }
  const matrixRows = [...perFilm.entries()].slice(0, 40);

  // Cost: prefer summed stage cost_usd; fall back to runs' actual/est.
  const stageCost = stages.reduce((a, s) => a + (Number(s.cost_usd) || 0), 0);
  const runActual = runs.reduce((a, r) => a + (Number(r.actual_cost_usd) || 0), 0);
  const runEst = runs.reduce((a, r) => a + (Number(r.est_cost_usd) || 0), 0);
  const costPrimary = stageCost > 0 ? stageCost : runActual;
  const costLabel = stageCost > 0 ? "summed stage cost_usd" : runActual > 0 ? "runs.actual_cost_usd" : "runs.est_cost_usd (estimate)";
  const costValue = costPrimary > 0 ? costPrimary : runEst;

  return (
    <div style={{ maxWidth: 1160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>The Film Factory</h1>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          observation plane — writes only flip a status column; execution stays on the Mac loop
        </span>
      </div>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Kpi label="Runs (recent)" value={fmt(runs.length)} />
        <Kpi label="Pending intake" value={fmt(pendingIntake.length)} />
        <Kpi label="R1 review queue" value={fmt(reviewQueue.length)} />
        <Kpi label="Stage rows" value={fmt(stages.length)} />
        <Kpi label="Open change orders" value={fmt(orders.length)} />
        <Kpi label="Cost" value={`$${costValue.toFixed(2)}`} />
      </div>

      {/* ⓪ Add films */}
      <Panel title="⓪ Add films — paste one title per line (or upload .txt/.csv), then ① Queue a run">
        <form action={addFilms} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            name="titles"
            rows={5}
            placeholder={"Parasite (2019)\nWerckmeister Harmonies 23160    ← a trailing number is read as a TMDB id\nThe Handmaiden\n# one per line: \"Title (Year)\" and/or \"Title <tmdb_id>\"; CSV header title,year,director,tmdb_id,tier also works"}
            style={{
              width: "100%", background: "#0b1220", color: "#e2e8f0",
              border: "1px solid rgba(148,163,184,0.2)", borderRadius: 6,
              padding: "8px 10px", fontSize: 12.5, fontFamily: "monospace", resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input type="file" name="file" accept=".txt,.csv" style={{ fontSize: 12, color: "#94a3b8" }} />
            <label style={{ fontSize: 12, color: "#94a3b8" }}>
              tier{" "}
              <select
                name="tier"
                defaultValue="full"
                style={{
                  background: "#0b1220", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 6, padding: "5px 8px", fontSize: 12,
                }}
              >
                <option value="full">full</option>
                <option value="catalog">catalog</option>
              </select>
            </label>
            <button
              type="submit"
              style={{
                background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6,
                padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              + Add to intake
            </button>
            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
              lands as <code>queued</code> intake (title-only is fine — the run resolves it); duplicates are skipped
            </span>
          </div>
        </form>

        {pendingIntake.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
              {pendingIntake.length} pending — the next ① Queue a run bundles these:
            </div>
            <table style={{ fontSize: 12.5, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th>title</th><th style={num}>year</th><th>tier</th><th>resolved?</th>
                </tr>
              </thead>
              <tbody>
                {pendingIntake.slice(0, 30).map((i) => (
                  <tr key={i.id}>
                    <td style={{ padding: "3px 0", color: "#e2e8f0" }}>{i.raw_title}</td>
                    <td style={num}>{i.year_hint ?? "–"}</td>
                    <td>{i.tier}</td>
                    <td>{i.film_id ? <span style={{ color: "#0ca30c" }}>✓ film</span> : <span style={{ color: "#e0a458" }}>on run</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ① Runs */}
      <Panel title="① Runs">
        <form action={queueRun} style={{ marginBottom: 12 }}>
          <button
            type="submit"
            style={{
              background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6,
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            ▶ Queue a run from approved intake
          </button>
          <span style={{ marginLeft: 10, fontSize: 11.5, color: "#94a3b8" }}>
            marks a run <code>queued</code> — the Mac watcher (factory-watch.sh) executes it; no tokens, no live-fire from here
          </span>
        </form>
        {runs.length === 0 ? (
          <Empty>No runs yet.</Empty>
        ) : (
          <table style={{ fontSize: 12.5, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th>id</th><th>mode</th><th style={num}>films</th><th>status</th>
                <th style={num}>est $</th><th style={num}>actual $</th><th>started</th><th>finished</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: "3px 0", color: "#e2e8f0" }}>{r.id}</td>
                  <td>{r.mode ?? "–"}</td>
                  <td style={num}>{fmt(r.film_count)}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td style={num}>{money(r.est_cost_usd)}</td>
                  <td style={num}>{money(r.actual_cost_usd)}</td>
                  <td style={{ color: "#94a3b8" }}>{fmtTs(r.started_at)}</td>
                  <td style={{ color: "#94a3b8" }}>{fmtTs(r.finished_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* ② Film × stage matrix */}
      <Panel title="② Film × stage matrix (status counts per film, most-recent stage_runs)">
        {matrixRows.length === 0 ? (
          <Empty>No stage runs yet.</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ fontSize: 12.5, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                  <th>film_id</th><th style={num}>stages</th><th>status breakdown</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map(([filmId, e]) => (
                  <tr key={filmId}>
                    <td style={{ padding: "3px 0", color: "#e2e8f0", fontFamily: "monospace", fontSize: 11.5 }}>
                      {filmId.slice(0, 8)}
                    </td>
                    <td style={num}>{e.total}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(e.byStatus).map(([st, n]) => (
                          <span key={st} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                            <StatusPill status={st} />
                            <span style={{ color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{n}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ③ R1 review queue */}
      <Panel title="③ R1 review queue (intake status = review — approve queues it; execution is Mac-side)">
        {reviewQueue.length === 0 ? (
          <Empty>Nothing awaiting review.</Empty>
        ) : (
          <table style={{ fontSize: 12.5, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                <th>id</th><th>title</th><th style={num}>year</th><th>tier</th><th>source</th>
                <th style={num}>conf</th><th>note</th><th style={{ textAlign: "right" }}>decide</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((i) => (
                <tr key={i.id}>
                  <td style={{ padding: "4px 0", color: "#e2e8f0" }}>{i.id}</td>
                  <td style={{ color: "#e2e8f0" }}>{i.raw_title ?? "–"}</td>
                  <td style={num}>{i.year_hint ?? "–"}</td>
                  <td>{i.tier ?? "–"}</td>
                  <td style={{ color: "#94a3b8" }}>{i.source ?? "–"}</td>
                  <td style={num}>{i.confidence != null ? i.confidence : "–"}</td>
                  <td style={{ color: "#94a3b8", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{i.resolve_note ?? ""}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <DecideButtons action={decideIntake} id={i.id} yes="approve" no="reject" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* ④ Gaps dashboard */}
      <Panel title={`④ Gaps — deficits among films created in the last ${gaps?.days ?? 30} days (${gaps?.total_recent ?? 0} films)`}>
        {!gaps ? (
          <Empty>{gapsRes.error ? `gaps_json error: ${gapsRes.error.message}` : "No gap data."}</Empty>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 14 }}>
              {Object.entries(gaps.deficits).map(([k, v]) => (
                <div key={k} style={{
                  background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 6, padding: "8px 12px",
                }}>
                  <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{k.replace(/_/g, " ")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: v > 0 ? "#f1f5f9" : "#475569", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {gaps.sample.length > 0 && (
              <>
                <SubTitle>Sample (recent films)</SubTitle>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ fontSize: 12, width: "100%" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "#94a3b8" }}>
                        <th>slug</th><th>title</th><th style={num}>figs</th>
                        <th style={{ textAlign: "center" }}>visible</th><th style={{ textAlign: "center" }}>analyzed</th>
                        <th style={{ textAlign: "center" }}>hold</th><th style={{ textAlign: "center" }}>ts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaps.sample.map((s) => (
                        <tr key={s.slug}>
                          <td style={{ padding: "2px 0", fontFamily: "monospace", fontSize: 11, color: "#cbd5e1" }}>{s.slug}</td>
                          <td style={{ color: "#e2e8f0", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</td>
                          <td style={{ ...num, color: s.figs < 3 ? "#e0a458" : "#cbd5e1" }}>{s.figs}</td>
                          <td style={{ textAlign: "center" }}><Bool v={s.visible} /></td>
                          <td style={{ textAlign: "center" }}><Bool v={s.analyzed} /></td>
                          <td style={{ textAlign: "center" }}><Bool v={s.hold} bad /></td>
                          <td style={{ textAlign: "center" }}><Bool v={s.ts} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Panel>

      {/* ⑤ Change orders */}
      <Panel title="⑤ Change orders (Sentinel proposals — approve or dismiss; apply is Mac-side)">
        {orders.length === 0 ? (
          <Empty>{coRes.error ? `change_orders_json error: ${coRes.error.message}` : "No open change orders."}</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((c) => (
              <div key={c.id} style={{
                background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 6, padding: "10px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>#{c.id}</span>
                  {c.kind && <span style={{ fontSize: 11, color: "#93c5fd", background: "rgba(96,165,250,0.15)", borderRadius: 4, padding: "1px 7px" }}>{c.kind}</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{c.title ?? "(untitled)"}</span>
                  <RiskPill risk={c.risk} />
                  <StatusPill status={c.status} />
                  <div style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
                    <DecideButtons action={decideChangeOrder} id={c.id} yes="approve" no="dismiss" />
                  </div>
                </div>
                {c.evidence && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, lineHeight: 1.5 }}>{c.evidence}</div>}
                {c.affected_stages && (
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 5 }}>
                    affected: {Array.isArray(c.affected_stages) ? c.affected_stages.join(", ") : String(c.affected_stages)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ⑥ Cost summary */}
      <Panel title="⑥ Cost summary">
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", fontSize: 13, color: "#cbd5e1" }}>
          <span>Total <b style={{ color: "#f1f5f9" }}>${costValue.toFixed(2)}</b> <span style={{ color: "#64748b", fontSize: 11 }}>({costLabel})</span></span>
          <span>Σ stage cost_usd <b style={{ color: "#f1f5f9" }}>${stageCost.toFixed(2)}</b></span>
          <span>Σ runs actual <b style={{ color: "#f1f5f9" }}>${runActual.toFixed(2)}</b></span>
          <span>Σ runs est <b style={{ color: "#f1f5f9" }}>${runEst.toFixed(2)}</b></span>
        </div>
      </Panel>

      <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 22, lineHeight: 1.6 }}>
        Reads the public service-role wrappers <code>factory_matrix_json</code> / <code>factory_gaps_json</code> /{" "}
        <code>factory_change_orders_json</code> (the <code>factory</code> schema is not PostgREST-exposed). Approve/reject buttons only
        flip a status column via <code>factory_intake_decide</code> / <code>factory_co_decide</code> — execution is picked up by the
        Mac-side loop (execution plane is separated from this observation plane).
      </p>
    </div>
  );
}

// ── presentational helpers (match metrics-page conventions) ───────────────

const num: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", paddingLeft: 14 };

function fmt(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "–";
}
function money(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? `$${n.toFixed(2)}` : "–";
}
function fmtTs(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

const STATUS_COLORS: Record<string, string> = {
  done: "#0ca30c", success: "#0ca30c", ok: "#0ca30c", approved: "#0ca30c", applied: "#0ca30c",
  running: "#60a5fa", queued: "#60a5fa", pending: "#e0a458", review: "#e0a458",
  failed: "#e66767", error: "#e66767", rejected: "#e66767", dismissed: "#64748b",
  held: "#e0a458", hold: "#e0a458",
};
function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "unknown").toLowerCase();
  const c = STATUS_COLORS[s] ?? "#94a3b8";
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 600, color: c,
      background: `${c}22`, borderRadius: 4, padding: "1px 7px",
    }}>{status ?? "unknown"}</span>
  );
}
function RiskPill({ risk }: { risk: string | null }) {
  if (!risk) return null;
  const c = risk === "high" ? "#e66767" : risk === "medium" ? "#e0a458" : "#94a3b8";
  return (
    <span style={{ fontSize: 11, color: c, border: `1px solid ${c}55`, borderRadius: 4, padding: "0 6px" }}>risk: {risk}</span>
  );
}
function Bool({ v, bad }: { v: boolean; bad?: boolean }) {
  const good = bad ? !v : v;
  return <span style={{ color: v ? (good ? "#0ca30c" : "#e0a458") : "#475569" }}>{v ? "✓" : "·"}</span>;
}

function DecideButtons({
  action, id, yes, no,
}: {
  action: (fd: FormData) => Promise<void>;
  id: number; yes: string; no: string;
}) {
  const btn = (color: string): CSSProperties => ({
    fontSize: 11.5, fontWeight: 600, color, background: `${color}18`,
    border: `1px solid ${color}44`, borderRadius: 5, padding: "3px 10px", cursor: "pointer", marginLeft: 6,
  });
  return (
    <span style={{ display: "inline-flex" }}>
      <form action={action} style={{ display: "inline" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value={yes} />
        <button type="submit" style={btn("#0ca30c")}>{yes}</button>
      </form>
      <form action={action} style={{ display: "inline" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value={no} />
        <button type="submit" style={btn("#e66767")}>{no}</button>
      </form>
    </span>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 8, marginTop: 4 }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: "#64748b" }}>{children}</div>;
}
