"use client";

/**
 * ImportWizard — bulk watch-history import.
 * One input surface (paste anything / drop a file) → auto format detection →
 * TMDB match review with candidate picking → chunked commit with progress.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { MatchCandidate, MatchResult, NormalizedRow } from "@/lib/import/types";

const IMG = "https://image.tmdb.org/t/p/w92";
const MATCH_BATCH = 25;
const COMMIT_BATCH = 50;

const SOURCE_LABEL: Record<string, string> = {
  letterboxd_zip: "Letterboxd 내보내기(ZIP)",
  letterboxd_csv: "Letterboxd CSV",
  imdb_csv: "IMDb 평가 CSV",
  sheet: "엑셀/CSV 표",
  watcha_text: "텍스트(규칙 해석)",
  freeform_llm: "텍스트(AI 해석)",
};

type RowState = NormalizedRow & {
  excluded?: boolean;
  match?: MatchCandidate | null;
  matchStatus?: "pending" | "matched" | "ambiguous" | "none";
  candidates?: MatchCandidate[];
};
type Summary = { added: number; updated: number; logged: number; skipped_dupes: number; failed: string[] };

export default function ImportWizard() {
  const [step, setStep] = useState<"input" | "review" | "done">("input");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("sheet");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const runMatch = useCallback(async (parsed: NormalizedRow[]) => {
    setBusy("영화 매칭 중…");
    const st: RowState[] = parsed.map((r) => ({ ...r, matchStatus: r.to_watchlist || !r.to_watchlist ? "pending" : "pending" }));
    setRows(st); setStep("review");
    for (let p = 0; p < st.length; p += MATCH_BATCH) {
      const batch = st.slice(p, p + MATCH_BATCH).map((r) => ({ i: r.i, title: r.title, year: r.year, tmdb_id: r.tmdb_id, imdb_id: r.imdb_id }));
      try {
        const res = await fetch("/api/import/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: batch }) });
        const d = await res.json();
        const map = new Map<number, MatchResult>((d.results || []).map((m: MatchResult) => [m.i, m]));
        setRows((prev) => prev.map((r) => {
          const m = map.get(r.i);
          return m ? { ...r, matchStatus: m.status, match: m.match ?? null, candidates: m.candidates } : r;
        }));
        setProgress(Math.min(100, Math.round(((p + MATCH_BATCH) / st.length) * 100)));
      } catch { /* leave batch as pending → shown as unmatched */ }
    }
    setBusy(null); setProgress(0);
  }, []);

  const parseText = async () => {
    if (!text.trim()) return;
    setBusy("해독 중…"); setError(null);
    try {
      const r = await fetch("/api/import/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error === "no rows" ? "인식된 영화가 없습니다. 형식을 확인해주세요." : "해석에 실패했습니다."); setBusy(null); return; }
      setSource(d.source); setWarnings(d.warnings || []); setFilename(null);
      await runMatch(d.rows);
    } catch { setError("서버 오류가 발생했습니다."); setBusy(null); }
  };

  const parseFile = async (f: File) => {
    setBusy(`${f.name} 해독 중…`); setError(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/import/parse", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setError(d.error === "no rows" ? "파일에서 영화를 찾지 못했습니다." : `파일 해석 실패: ${d.error || ""}`); setBusy(null); return; }
      setSource(d.source); setWarnings(d.warnings || []); setFilename(f.name);
      await runMatch(d.rows);
    } catch { setError("서버 오류가 발생했습니다."); setBusy(null); }
  };

  const included = useMemo(() => rows.filter((r) => !r.excluded && r.match?.tmdb_id), [rows]);
  const unmatched = useMemo(() => rows.filter((r) => !r.excluded && !r.match?.tmdb_id), [rows]);

  const commit = async () => {
    setBusy("저장 중…"); setError(null); setProgress(0);
    let jobId: string | undefined;
    const acc: Summary = { added: 0, updated: 0, logged: 0, skipped_dupes: 0, failed: [] };
    const payload = included.map((r) => ({
      tmdb_id: r.match!.tmdb_id, title: r.title, year: r.year, rating: r.rating, watched_at: r.watched_at,
      note: r.note, tags: r.tags, rewatch: r.rewatch, to_watchlist: r.to_watchlist, raw: r.raw,
    }));
    for (let p = 0; p < payload.length; p += COMMIT_BATCH) {
      try {
        const r = await fetch("/api/import/commit", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ job_id: jobId, source, filename, overwrite, rows: payload.slice(p, p + COMMIT_BATCH) }),
        });
        const d = await r.json();
        if (!r.ok) { setError("일부 저장에 실패했습니다."); break; }
        jobId = d.job_id;
        acc.added += d.added; acc.updated += d.updated; acc.logged += d.logged; acc.skipped_dupes += d.skipped_dupes;
        acc.failed.push(...(d.failed || []));
        setProgress(Math.min(100, Math.round(((p + COMMIT_BATCH) / payload.length) * 100)));
      } catch { setError("서버 오류로 중단되었습니다."); break; }
    }
    setSummary(acc); setBusy(null); setStep("done");
  };

  const pick = (i: number, c: MatchCandidate | null) =>
    setRows((prev) => prev.map((r) => (r.i === i ? { ...r, match: c, matchStatus: c ? "matched" : r.matchStatus } : r)));
  const toggle = (i: number) =>
    setRows((prev) => prev.map((r) => (r.i === i ? { ...r, excluded: !r.excluded } : r)));

  /* ---------------- render ---------------- */

  if (step === "done" && summary) {
    return (
      <div className="iw">
        <h2 style={{ margin: "0 0 12px" }}>가져오기 완료</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7 }}>
          새로 추가 <b>{summary.added}</b>편 · 갱신 <b>{summary.updated}</b>편 · 관람 이력 기록 <b>{summary.logged}</b>건
          {summary.skipped_dupes > 0 && <> · 중복 스킵 {summary.skipped_dupes}건</>}
        </p>
        {summary.failed.length > 0 && (
          <p className="muted" style={{ fontSize: 13 }}>처리 실패: {summary.failed.join(", ")}</p>
        )}
        <p style={{ marginTop: 16 }}>
          <a href="/me" style={{ marginRight: 16 }}>← 내 대시보드로</a>
          <button type="button" onClick={() => { setStep("input"); setRows([]); setSummary(null); setText(""); }}>추가로 가져오기</button>
        </p>
      </div>
    );
  }

  if (step === "review") {
    const st = { matched: 0, ambiguous: 0, none: 0, pending: 0 };
    for (const r of rows) if (!r.excluded) st[r.matchStatus ?? "pending"]++;
    return (
      <div className="iw">
        <p style={{ fontSize: 14 }} className="muted">
          감지된 형식: <b>{SOURCE_LABEL[source] ?? source}</b>{filename ? ` · ${filename}` : ""} · 총 {rows.length}행
          {busy && <> · {busy} {progress > 0 && `${progress}%`}</>}
        </p>
        {warnings.map((w, k) => <p key={k} className="muted" style={{ fontSize: 13, margin: "2px 0" }}>⚠ {w}</p>)}
        <p style={{ fontSize: 14 }}>
          매칭 확정 <b>{st.matched}</b> · 후보 선택 필요 <b style={{ color: st.ambiguous ? "#b45309" : undefined }}>{st.ambiguous}</b> · 미매칭 <b style={{ color: st.none ? "#b91c1c" : undefined }}>{st.none}</b>
        </p>

        <div style={{ maxHeight: 480, overflowY: "auto", border: "1px solid var(--hairline)", borderRadius: 8 }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--bg, #fff)" }}>
                <th style={{ padding: 6 }}></th><th>제목</th><th>년도</th><th>별점</th><th>관람일</th><th>메모</th><th style={{ minWidth: 220 }}>TMDB 매칭</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i} style={{ borderTop: "1px solid var(--hairline)", opacity: r.excluded ? 0.4 : 1 }}>
                  <td style={{ padding: 6 }}>
                    <input type="checkbox" checked={!r.excluded} onChange={() => toggle(r.i)} aria-label="포함" />
                  </td>
                  <td style={{ padding: 6 }}>{r.title}{r.to_watchlist && <span className="muted"> (왓치리스트)</span>}{r.rewatch && <span className="muted"> ↻</span>}</td>
                  <td>{r.year ?? ""}</td>
                  <td>{r.rating != null ? `★${r.rating}` : ""}</td>
                  <td>{r.watched_at ?? ""}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.note}>{r.note ?? ""}</td>
                  <td style={{ padding: 6 }}>
                    {r.match ? (
                      <span>
                        {r.match.poster_path && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${IMG}${r.match.poster_path}`} alt="" style={{ height: 30, verticalAlign: "middle", marginRight: 6, borderRadius: 2 }} />
                        )}
                        ✓ {r.match.title} ({r.match.year})
                        {(r.candidates?.length ?? 0) > 0 && (
                          <button type="button" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => pick(r.i, null)}>변경</button>
                        )}
                      </span>
                    ) : r.matchStatus === "ambiguous" && r.candidates?.length ? (
                      <select defaultValue="" onChange={(e) => { const c = r.candidates?.[Number(e.target.value)]; if (c) pick(r.i, c); }}>
                        <option value="" disabled>후보 선택…</option>
                        {r.candidates.map((c, ci) => <option key={c.tmdb_id} value={ci}>{c.title} ({c.year})</option>)}
                      </select>
                    ) : r.matchStatus === "none" ? (
                      <ManualSearch onPick={(c) => pick(r.i, c)} />
                    ) : (
                      <span className="muted">…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />{" "}
            기존 별점/메모를 가져온 값으로 덮어쓰기
          </label>
          <button type="button" disabled={!!busy || included.length === 0} onClick={commit} style={{ fontWeight: 600 }}>
            {included.length}편 가져오기
          </button>
          {unmatched.length > 0 && <span className="muted" style={{ fontSize: 13 }}>매칭 안 된 {unmatched.length}행은 제외됩니다</span>}
          <button type="button" disabled={!!busy} onClick={() => { setStep("input"); setRows([]); }}>처음으로</button>
        </div>
        {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
      </div>
    );
  }

  // input step
  return (
    <div className="iw">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
        style={{ border: `2px dashed ${drag ? "#333" : "var(--hairline, #ccc)"}`, borderRadius: 10, padding: 18, marginBottom: 14, textAlign: "center" }}
      >
        <p style={{ margin: "4px 0 8px", fontSize: 14 }}>
          파일을 끌어다 놓거나{" "}
          <button type="button" onClick={() => fileRef.current?.click()} style={{ textDecoration: "underline" }}>선택</button>
          {" "}— Letterboxd 내보내기 ZIP, 엑셀(.xlsx), CSV(IMDb·왓챠 백업 등)
        </p>
        <input ref={fileRef} type="file" accept=".zip,.csv,.tsv,.xlsx,.xls,.txt" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ""; }} />
      </div>

      <p style={{ fontSize: 14, margin: "0 0 6px" }}>또는 아무 텍스트나 붙여넣기 — 왓챠 프로필 화면 복사, 메모장 목록 등 형식 무관:</p>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"예)\n기생충\n2019 · 평가함 ★ 5.0\n\n헤어질 결심 (2022) ★4.5 — 미결로 남기고 싶은 마음\n올드보이 2003년 별점 5"}
        style={{ width: "100%", minHeight: 180, fontSize: 14, padding: 10, border: "1px solid var(--hairline, #ccc)", borderRadius: 8, fontFamily: "inherit" }}
      />
      <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="button" disabled={!!busy || !text.trim()} onClick={parseText} style={{ fontWeight: 600 }}>해독하기</button>
        {busy && <span className="muted" style={{ fontSize: 13 }}>{busy}</span>}
      </div>
      {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        별점은 자동으로 5점 척도(0.5 단위)로 변환됩니다. 저장 전 검수 화면에서 확인·수정할 수 있고, 원본 데이터는 관람 이력에 손실 없이 보관됩니다.
      </p>
    </div>
  );
}

/* Inline manual TMDB search for unmatched rows (reuses /api/tmdb-search). */
function ManualSearch({ onPick }: { onPick: (c: MatchCandidate) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MatchCandidate[]>([]);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (v: string) => {
    setQ(v);
    if (t.current) clearTimeout(t.current);
    if (v.trim().length < 2) { setHits([]); return; }
    t.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tmdb-search?q=${encodeURIComponent(v.trim())}`);
        const d = await r.json();
        setHits((d.results || []).map((h: { tmdb_id: number; title: string; year: string; poster_path: string | null }) => ({
          tmdb_id: h.tmdb_id, title: h.title, year: h.year, poster_path: h.poster_path,
        })));
      } catch { setHits([]); }
    }, 300);
  };
  return (
    <span style={{ position: "relative" }}>
      <input type="search" value={q} placeholder="직접 검색…" onChange={(e) => onChange(e.target.value)} style={{ fontSize: 12, width: 140 }} />
      {hits.length > 0 && (
        <span style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, background: "var(--bg, #fff)", border: "1px solid var(--hairline, #ccc)", borderRadius: 6, minWidth: 220, display: "block", maxHeight: 200, overflowY: "auto" }}>
          {hits.map((h) => (
            <button key={h.tmdb_id} type="button" style={{ display: "block", width: "100%", textAlign: "left", padding: "4px 8px", fontSize: 12 }}
              onClick={() => { onPick(h); setHits([]); setQ(""); }}>
              {h.title} ({h.year})
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
