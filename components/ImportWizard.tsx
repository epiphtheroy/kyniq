"use client";

/**
 * ImportWizard — bulk watch-history import.
 * One input surface (paste anything / drop a file) → auto format detection →
 * TMDB match review with candidate picking → chunked commit with progress.
 *
 * The flow is shown as a 5-stage process diagram + a live, work-status-style
 * progress panel so people understand the wait and stay patient.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchCandidate, MatchResult, NormalizedRow } from "@/lib/import/types";
import { createClient } from "@/lib/supabase/client";
import {
  ALL_ACCEPT,
  CONNECTORS,
  connector,
  readAwaiting,
  writeAwaiting,
  type Connector,
  type ConnectorId,
} from "@/lib/import/connectors";

const IMG = "https://image.tmdb.org/t/p/w92";
const MATCH_BATCH = 25;
const COMMIT_BATCH = 50;

const SOURCE_LABEL: Record<string, string> = {
  letterboxd_zip: "Letterboxd export (ZIP)",
  letterboxd_csv: "Letterboxd CSV",
  imdb_csv: "IMDb ratings CSV",
  netflix_csv: "Netflix viewing history (CSV)",
  sheet: "Spreadsheet (Excel / CSV)",
  watcha_text: "Text list (rule-parsed)",
  freeform_llm: "Text list (AI-parsed)",
};

/** Which stage of the pipeline is live — drives the stepper + progress copy. */
type Phase = "idle" | "reading" | "matching" | "saving";

type RowState = NormalizedRow & {
  excluded?: boolean;
  match?: MatchCandidate | null;
  matchStatus?: "pending" | "matched" | "ambiguous" | "none";
  candidates?: MatchCandidate[];
};
type Summary = { added: number; updated: number; logged: number; skipped_dupes: number; failed: string[] };

/* Process diagram stages, in order. */
const STAGES = [
  { key: "add", lbl: "Add", sub: "paste or drop" },
  { key: "read", lbl: "Read", sub: "detect format" },
  { key: "match", lbl: "Match", sub: "find on TMDB" },
  { key: "review", lbl: "Review", sub: "check & fix" },
  { key: "save", lbl: "Save", sub: "to your library" },
] as const;

export default function ImportWizard() {
  const [step, setStep] = useState<"input" | "review" | "done">("input");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [progNote, setProgNote] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** The session lapsed mid-flow. Its own state because its fix is a link, not
   *  a retry — and the generic copy told people their LIST was wrong. */
  const [authLost, setAuthLost] = useState(false);
  const [source, setSource] = useState<string>("sheet");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [text, setText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [drag, setDrag] = useState(false);
  /** Which connector's guide is open — the tile teaches before it demands. */
  const [openGuide, setOpenGuide] = useState<ConnectorId | null>(null);
  /** Narrowed per connector so the picker (and iOS Files) shows the right file. */
  const [accept, setAccept] = useState(ALL_ACCEPT);
  /** "You were exporting from IMDb" — survives the trip to another tab. */
  const [awaiting, setAwaiting] = useState<{ id: ConnectorId; stage: "collect" | "file" } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  const busy = phase !== "idle";
  const addLog = (line: string) => setLog((l) => [...l, line]);

  /** Current stage for the diagram, derived from step + phase. */
  const activeStage: string = (() => {
    if (step === "done") return "done";
    if (step === "input") return phase === "reading" ? "read" : "add";
    return phase === "matching" ? "match" : phase === "saving" ? "save" : "review";
  })();
  const stageIdx = STAGES.findIndex((s) => s.key === activeStage);
  const doneIdx = activeStage === "done" ? STAGES.length : stageIdx;

  const progTitle =
    phase === "reading" ? "Reading your list…" :
    phase === "matching" ? "Matching your films to TMDB" :
    phase === "saving" ? "Saving to your library" : "";

  const runMatch = useCallback(async (parsed: NormalizedRow[], srcLabel: string) => {
    setPhase("matching"); setProgress(0);
    addLog(`Detected ${srcLabel} — ${parsed.length} title${parsed.length === 1 ? "" : "s"}`);
    const st: RowState[] = parsed.map((r) => ({ ...r, matchStatus: "pending" as const }));
    setRows(st); setStep("review");
    const nb = Math.max(1, Math.ceil(st.length / MATCH_BATCH));
    for (let p = 0; p < st.length; p += MATCH_BATCH) {
      const b = Math.floor(p / MATCH_BATCH) + 1;
      const done = Math.min(st.length, p + MATCH_BATCH);
      setProgNote(`Batch ${b} of ${nb} · ${done} of ${st.length} titles checked`);
      const batch = st.slice(p, p + MATCH_BATCH).map((r) => ({ i: r.i, title: r.title, year: r.year, tmdb_id: r.tmdb_id, imdb_id: r.imdb_id }));
      try {
        const res = await fetch("/api/import/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: batch }) });
        const d = await res.json();
        const map = new Map<number, MatchResult>((d.results || []).map((m: MatchResult) => [m.i, m]));
        setRows((prev) => prev.map((r) => {
          const m = map.get(r.i);
          return m ? { ...r, matchStatus: m.status, match: m.match ?? null, candidates: m.candidates } : r;
        }));
        setProgress(Math.round((done / st.length) * 100));
      } catch { /* leave batch as pending → shown as unmatched */ }
    }
    addLog(`Matched ${st.length} title${st.length === 1 ? "" : "s"} against TMDB`);
    setPhase("idle"); setProgress(0); setProgNote("");
  }, []);

  const parseText = async () => {
    if (!text.trim()) return;
    setPhase("reading"); setProgress(0); setProgNote("Detecting format from your text…"); setError(null); setAuthLost(false); setLog([]);
    try {
      const r = await fetch("/api/import/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json();
      if (r.status === 401) { setAuthLost(true); setPhase("idle"); return; }
      if (!r.ok) { setError(d.error === "no rows" ? "No films recognized — check the format and try again." : "Couldn't read that. Try pasting a plain list of titles."); setPhase("idle"); return; }
      setSource(d.source); setWarnings(d.warnings || []); setFilename(null);
      await runMatch(d.rows, SOURCE_LABEL[d.source] ?? d.source);
    } catch { setError("Something went wrong on our end. Please try again."); setPhase("idle"); }
  };

  const parseFile = async (f: File) => {
    setPhase("reading"); setProgress(0); setProgNote(`Reading ${f.name}…`); setError(null); setAuthLost(false); setLog([]);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/import/parse", { method: "POST", body: fd });
      const d = await r.json();
      if (r.status === 401) { setAuthLost(true); setPhase("idle"); return; }
      if (!r.ok) { setError(d.error === "no rows" ? "No films found in that file." : `Couldn't read the file: ${d.error || ""}`); setPhase("idle"); return; }
      setSource(d.source); setWarnings(d.warnings || []); setFilename(f.name);
      await runMatch(d.rows, SOURCE_LABEL[d.source] ?? d.source);
    } catch { setError("Something went wrong on our end. Please try again."); setPhase("idle"); }
  };

  const included = useMemo(() => rows.filter((r) => !r.excluded && r.match?.tmdb_id), [rows]);
  const unmatched = useMemo(() => rows.filter((r) => !r.excluded && !r.match?.tmdb_id), [rows]);

  const commit = async () => {
    setPhase("saving"); setProgress(0); setError(null);
    let jobId: string | undefined;
    const acc: Summary = { added: 0, updated: 0, logged: 0, skipped_dupes: 0, failed: [] };
    const payload = included.map((r) => ({
      tmdb_id: r.match!.tmdb_id, title: r.title, year: r.year, rating: r.rating, watched_at: r.watched_at,
      note: r.note, tags: r.tags, rewatch: r.rewatch, to_watchlist: r.to_watchlist, raw: r.raw,
    }));
    const nb = Math.max(1, Math.ceil(payload.length / COMMIT_BATCH));
    for (let p = 0; p < payload.length; p += COMMIT_BATCH) {
      const b = Math.floor(p / COMMIT_BATCH) + 1;
      const done = Math.min(payload.length, p + COMMIT_BATCH);
      setProgNote(`Batch ${b} of ${nb} · ${done} of ${payload.length} films`);
      try {
        const r = await fetch("/api/import/commit", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ job_id: jobId, source, filename, overwrite, rows: payload.slice(p, p + COMMIT_BATCH) }),
        });
        const d = await r.json();
        if (r.status === 401) { setAuthLost(true); break; }
        if (!r.ok) { setError("Some films couldn't be saved. Please try again."); break; }
        jobId = d.job_id;
        acc.added += d.added; acc.updated += d.updated; acc.logged += d.logged; acc.skipped_dupes += d.skipped_dupes;
        acc.failed.push(...(d.failed || []));
        setProgress(Math.round((done / payload.length) * 100));
      } catch { setError("A server error interrupted the save."); break; }
    }
    setSummary(acc); setPhase("idle"); setProgNote(""); setStep("done");
  };

  /* ------------- connector flow (ported from the app's connect screen) -------------
   * tile → guide (real steps + the page that starts them) → [collect, for the
   * services that queue] → choose the file. Never a file dialog for a file the
   * service has not produced yet.
   */

  const chooseFile = useCallback((c?: Connector) => {
    if (c?.accept) setAccept(c.accept);
    // Set before the click so the picker opens already narrowed. React applies
    // the attribute synchronously on the DOM node here rather than next paint.
    if (fileRef.current) {
      fileRef.current.accept = c?.accept ?? ALL_ACCEPT;
      fileRef.current.click();
    }
  }, []);

  const openGuideFor = useCallback((id: ConnectorId) => {
    setOpenGuide((cur) => (cur === id ? null : id));
    const c = connector(id);
    if (c?.accept) setAccept(c.accept);
    // The guide sits under the tiles; on a phone that is below the fold.
    requestAnimationFrame(() => guideRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, []);

  /** Leaves for the service, and remembers that we did. */
  const leaveFor = useCallback((c: Connector, target: "export" | "collect") => {
    const url = target === "collect" ? c.collectUrl : c.exportUrl;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    // IMDb queues the export, so the first hop leaves you waiting to COLLECT,
    // not waiting to pick — the banner has to say the true next step.
    const stage: "collect" | "file" = target === "export" && c.collectUrl ? "collect" : "file";
    if (c.kind === "file") {
      writeAwaiting({ id: c.id, stage, at: Date.now() });
      setAwaiting({ id: c.id, stage });
    }
  }, []);

  const dismissAwaiting = useCallback(() => { writeAwaiting(null); setAwaiting(null); }, []);

  // Restore the breadcrumb on mount, and again whenever the tab comes back —
  // the web's version of the app's AppState "active" check.
  useEffect(() => {
    const check = () => {
      const a = readAwaiting();
      setAwaiting(a ? { id: a.id, stage: a.stage } : null);
    };
    check();
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const pick = (i: number, c: MatchCandidate | null) =>
    setRows((prev) => prev.map((r) => (r.i === i ? { ...r, match: c, matchStatus: c ? "matched" : r.matchStatus } : r)));
  const toggle = (i: number) =>
    setRows((prev) => prev.map((r) => (r.i === i ? { ...r, excluded: !r.excluded } : r)));

  /* ---------------- shared pieces ---------------- */

  // Rendered via {stepper()} / {progressPanel()} (plain calls, not <Stepper/>)
  // so the progress bar updates the same DOM node and its width transition
  // animates smoothly instead of remounting on every batch tick.
  const stepper = () => (
    <ol className="iw-steps" aria-label="Import steps">
      {STAGES.map((s, i) => {
        const cls = i < doneIdx ? "done" : i === stageIdx && activeStage !== "done" ? "active" : "";
        return (
          <li key={s.key} className={`iw-step ${cls}`}>
            <span className="dot">{i < doneIdx ? "✓" : i + 1}</span>
            <span className="lbl">{s.lbl}</span>
            <span className="sub">{s.sub}</span>
          </li>
        );
      })}
    </ol>
  );

  /** A lapsed session is not a bad file — say so, and hand back the door.
   *  The rows already on screen survive: signing in opens in a new tab. */
  const authNotice = () => (
    <p className="iw-authlost" role="alert">
      <b>You&apos;re signed out.</b> Imports write to your own library, so this needs a session.{" "}
      <a href="/login?next=/me/import" target="_blank" rel="noopener noreferrer">Sign in in a new tab ↗</a>{" "}
      then press the button again — nothing you&apos;ve entered is lost.
    </p>
  );

  const progressPanel = () =>
    busy ? (
      <div className="iw-prog" role="status" aria-live="polite">
        <div className="iw-prog-head">
          <span className="iw-spin" aria-hidden="true" />
          <span className="iw-prog-title">{progTitle}</span>
        </div>
        {progNote && <div className="iw-prog-note">{progNote}{progress > 0 ? ` · ${progress}%` : ""}</div>}
        <div className="iw-bar"><i style={{ width: `${progress}%` }} /></div>
        {log.length > 0 && (
          <ul className="iw-log">{log.map((l, k) => <li key={k}>{l}</li>)}</ul>
        )}
      </div>
    ) : null;

  /* ---------------- render ---------------- */

  if (step === "done" && summary) {
    return (
      <div className="iw">
        {stepper()}
        <h2 style={{ margin: "0 0 12px" }}>Import complete</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7 }}>
          <b>{summary.added}</b> added · <b>{summary.updated}</b> updated · <b>{summary.logged}</b> watch record{summary.logged === 1 ? "" : "s"} logged
          {summary.skipped_dupes > 0 && <> · {summary.skipped_dupes} duplicate{summary.skipped_dupes === 1 ? "" : "s"} skipped</>}
        </p>
        {summary.failed.length > 0 && (
          <p className="muted" style={{ fontSize: 13 }}>Couldn&apos;t process: {summary.failed.join(", ")}</p>
        )}
        <div className="iw-benefit" style={{ marginTop: 18 }}>
          <h3>What just changed</h3>
          <ul>
            <li><span className="b">◑</span><span>Every film you&apos;ve seen now carries a <b>red border</b> across the whole site — posters, the galaxy, the locations.</span></li>
            <li><span className="b">✦</span><span><b>My Room</b> is now unlocked in your navigation — your personal workspace for rating, writing, and organizing.</span></li>
            <li><span className="b">◎</span><span>Recommendations and lists re-center on <b>your</b> history instead of the global map.</span></li>
          </ul>
        </div>
        <p style={{ marginTop: 18, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <a className="btn iw-cta" href="/room">Go to My Room →</a>
          <button type="button" className="btn-ghost iw-cta-2nd" onClick={() => { setStep("input"); setRows([]); setSummary(null); setText(""); setLog([]); }}>Import more</button>
        </p>
      </div>
    );
  }

  if (step === "review") {
    const st = { matched: 0, ambiguous: 0, none: 0, pending: 0 };
    for (const r of rows) if (!r.excluded) st[r.matchStatus ?? "pending"]++;
    return (
      <div className="iw">
        {stepper()}
        {progressPanel()}
        <p style={{ fontSize: 14 }} className="muted">
          Detected format: <b>{SOURCE_LABEL[source] ?? source}</b>{filename ? ` · ${filename}` : ""} · {rows.length} rows
        </p>
        {warnings.map((w, k) => <p key={k} className="muted" style={{ fontSize: 13, margin: "2px 0" }}>⚠ {w}</p>)}
        <p style={{ fontSize: 14 }}>
          Confirmed <b>{st.matched}</b> · needs a pick <b style={{ color: st.ambiguous ? "#b45309" : undefined }}>{st.ambiguous}</b> · no match <b style={{ color: st.none ? "#b91c1c" : undefined }}>{st.none}</b>
        </p>

        <div style={{ maxHeight: 480, overflowY: "auto", border: "1px solid var(--hairline)", borderRadius: 8 }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", position: "sticky", top: 0, background: "var(--surface, #fff)" }}>
                <th style={{ padding: 6 }}></th><th>Title</th><th>Year</th><th>Rating</th><th>Watched</th><th>Note</th><th style={{ minWidth: 220 }}>TMDB match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i} style={{ borderTop: "1px solid var(--hairline)", opacity: r.excluded ? 0.4 : 1 }}>
                  <td style={{ padding: 6 }}>
                    <input type="checkbox" checked={!r.excluded} onChange={() => toggle(r.i)} aria-label="Include" />
                  </td>
                  <td style={{ padding: 6 }}>{r.title}{r.to_watchlist && <span className="muted"> (watchlist)</span>}{r.rewatch && <span className="muted"> ↻</span>}</td>
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
                          <button type="button" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => pick(r.i, null)}>change</button>
                        )}
                      </span>
                    ) : r.matchStatus === "ambiguous" && r.candidates?.length ? (
                      <select defaultValue="" onChange={(e) => { const c = r.candidates?.[Number(e.target.value)]; if (c) pick(r.i, c); }}>
                        <option value="" disabled>Choose a match…</option>
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

        <div className="iw-actions">
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />{" "}
            Overwrite existing ratings/notes with imported values
          </label>
          <button type="button" className="btn" disabled={busy || included.length === 0} onClick={commit}>
            Import {included.length} film{included.length === 1 ? "" : "s"}
          </button>
          {unmatched.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{unmatched.length} unmatched row{unmatched.length === 1 ? "" : "s"} will be skipped</span>}
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setStep("input"); setRows([]); setLog([]); }}>Start over</button>
        </div>
        {authLost && authNotice()}
        {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
      </div>
    );
  }

  // input step
  return (
    <div className="iw">
      {stepper()}

      <div className="iw-benefit">
        <h3>Why import your history</h3>
        <ul>
          <li><span className="b">◑</span><span>Every film you&apos;ve seen gets a <b>red border</b> everywhere on the site, so you always know what&apos;s new to you.</span></li>
          <li><span className="b">✦</span><span>Unlocks <b>My Room</b> in your navigation — a private workspace to rate, write, and organize what you&apos;ve watched.</span></li>
          <li><span className="b">◎</span><span>Everything — recommendations, galaxy, locations, lists — <b>re-centers on your taste</b>.</span></li>
        </ul>
      </div>

      {progressPanel()}

      {!busy && (
        <>
          {/* You left for the service; this is what you came back to do. */}
          {awaiting && (() => {
            const c = connector(awaiting.id);
            if (!c) return null;
            return (
              <div className="iw-return" role="status">
                <span className="iw-return-txt">
                  {awaiting.stage === "collect"
                    ? <>Waiting on <b>{c.name}</b> to prepare your export.</>
                    : <>Got your <b>{c.name}</b> file?</>}
                </span>
                <span className="iw-return-acts">
                  {awaiting.stage === "collect" && c.collectUrl && (
                    <button type="button" className="btn iw-return-cta" onClick={() => leaveFor(c, "collect")}>
                      {c.collectLabel ?? "Collect it ↗"}
                    </button>
                  )}
                  <button type="button" className="btn iw-return-cta" onClick={() => chooseFile(c)}>Choose the file</button>
                  <button type="button" className="iw-linkbtn dim" onClick={dismissAwaiting}>Not now</button>
                </span>
              </div>
            );
          })()}

          <div className="iw-sources">
            {/* A group of buttons, not a list: role="listitem" on a <button>
                replaces the button semantics, which is why aria-expanded had
                nowhere valid to live. */}
            <div className="iw-tiles" role="group" aria-label="Where your history comes from">
              {CONNECTORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`iw-tile${openGuide === c.id ? " sel" : ""}`}
                  aria-expanded={openGuide === c.id}
                  onClick={() => openGuideFor(c.id)}
                >
                  <span className="t">{c.name}</span>
                  <span className="f">{c.fmt}</span>
                </button>
              ))}
            </div>

            {/* The guide, not a file dialog. Every service asks for something
                different, and one of them (IMDb) cannot hand you the file at
                all until it has prepared it — so the steps come first and the
                picker is the LAST button, never the first thing that happens. */}
            {openGuide && (() => {
              const c = connector(openGuide);
              if (!c) return null;
              return (
                <div className="iw-guide" ref={guideRef}>
                  <div className="iw-guide-head">
                    <b>{c.name}</b>
                    <button type="button" className="iw-linkbtn dim" onClick={() => setOpenGuide(null)} aria-label="Close the guide">Close</button>
                  </div>
                  <ol className="iw-guide-steps">
                    {c.steps.map((st, i) => <li key={i}><span className="n">{i + 1}</span><span>{st}</span></li>)}
                  </ol>
                  {c.note && <p className="iw-guide-note">{c.note}</p>}
                  <div className="iw-guide-acts">
                    {c.exportUrl && (
                      <button type="button" className="btn iw-guide-cta" onClick={() => leaveFor(c, "export")}>
                        Open {c.name} ↗
                      </button>
                    )}
                    {c.collectUrl && (
                      <button type="button" className="btn-ghost iw-guide-cta" onClick={() => leaveFor(c, "collect")}>
                        {c.collectLabel}
                      </button>
                    )}
                    {c.kind === "file" ? (
                      <button type="button" className="btn-ghost iw-guide-cta" onClick={() => chooseFile(c)}>
                        I have the file — choose it
                      </button>
                    ) : (
                      <button type="button" className="btn-ghost iw-guide-cta" onClick={() => { textRef.current?.focus(); textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>
                        Paste it below
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            <ConnectTiles />
          </div>

          <div
            className={`iw-drop${drag ? " drag" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
          >
            <div className="ico">⤓</div>
            <p className="lead">
              Drag a file here, or{" "}
              <button type="button" className="iw-linkbtn" onClick={() => chooseFile()}>browse</button>
            </p>
            <p className="sub">Letterboxd export (ZIP), IMDb ratings (CSV), Netflix viewing history (CSV), Excel (.xlsx), or any CSV — Watcha lists paste below</p>
            {/* NOT display:none. Safari (and iOS Safari in particular) will not
                open the picker for a programmatic .click() on an input that is
                display:none — the tap reads as a dead button. Visually hidden
                but rendered works everywhere. */}
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="iw-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { dismissAwaiting(); parseFile(f); }
                e.target.value = "";
              }}
            />
          </div>

          <p style={{ fontSize: 14, margin: "0 0 6px" }}>Or paste any text — a Letterboxd diary, a notes-app list, anything. Format doesn&apos;t matter:</p>
          <textarea
            ref={textRef}
            className="iw-textarea"
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"e.g.\nParasite\n2019 · watched ★5.0\n\nEverything Everywhere All at Once (2022) ★4.5 — the bagel got me\nThe Godfather 1972 rated 5\nPortrait of a Lady on Fire — want to watch"}
          />
          <div className="iw-actions">
            <button type="button" className="btn" disabled={!text.trim()} onClick={parseText}>Decode my list →</button>
          </div>
          {authLost && authNotice()}
          {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}

          <div className="iw-trust">
            <span className="ico" aria-hidden="true">🔒</span>
            <span>
              <b>Go ahead — this is safe.</b> Your list is private to your account, and nothing is saved until you review and confirm on the next screen.
              We keep your original entries intact, and you can edit or delete anything anytime.
            </span>
          </div>

          <p className="iw-note">
            Ratings are normalized to a 5-star scale (0.5 steps). You&apos;ll confirm and fix every match before anything is written to your library.
          </p>
        </>
      )}
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
      <input type="search" value={q} placeholder="Search…" onChange={(e) => onChange(e.target.value)} style={{ fontSize: 12, width: 140 }} />
      {hits.length > 0 && (
        <span style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, background: "var(--surface, #fff)", border: "1px solid var(--hairline, #ccc)", borderRadius: 6, minWidth: 220, display: "block", maxHeight: 200, overflowY: "auto" }}>
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

/* ---------------- OAuth auto-sync tiles (Trakt / TMDB / Simkl) ----------------
 * Web leg of Connect (HANDOFF-커넥트-기록이관.md §2.4). Status comes from the
 * me_connections() RPC (SECURITY DEFINER, auth.uid-scoped — same one the app
 * uses); connect goes /start → provider → /connect-callback → /callback, all
 * token exchange server-side. Everything fails soft: an RPC error or a 503
 * from /start (env not configured) shows an honest "Coming soon" state. */

type ConnectProvider = "trakt" | "tmdb" | "simkl";

/** Token-free connection row from the me_connections() RPC. */
type ConnectionRow = {
  provider: ConnectProvider;
  status: "connected" | "error" | "revoked";
  last_sync_at: string | null;
  synced_films: number | null;
  error: string | null;
  created_at: string;
};

const CONNECT_PROVIDERS: ConnectProvider[] = ["trakt", "tmdb", "simkl"];
const CONNECT_LABEL: Record<ConnectProvider, string> = { trakt: "Trakt", tmdb: "TMDB", simkl: "Simkl" };
const COMING_SOON = "Coming soon — auto-sync in preparation, opening here and in the app together";
const PENDING_KEY = "mt-connect-pending";

function ConnectTiles() {
  const [conns, setConns] = useState<Record<string, ConnectionRow>>({});
  const [rpcOk, setRpcOk] = useState<boolean | null>(null); // null = loading
  const [soon, setSoon] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<ConnectProvider | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadStates = useCallback(async () => {
    try {
      const { data, error } = await createClient().rpc("me_connections");
      if (error) { setRpcOk(false); return; }
      const map: Record<string, ConnectionRow> = {};
      for (const r of (data ?? []) as ConnectionRow[]) map[r.provider] = r;
      setConns(map); setRpcOk(true);
    } catch { setRpcOk(false); }
  }, []);

  useEffect(() => {
    // Inline outcome of the /connect-callback round-trip (?connected / ?connect_error).
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get("connected");
    const err = sp.get("connect_error");
    if (ok) setNote(`${CONNECT_LABEL[ok as ConnectProvider] ?? ok} connected — press "Sync now" to pull your history.`);
    else if (err) setNote(err === "denied" ? "Connection cancelled on the provider's side." : `Connection failed (${err}). Please try again.`);
    if (ok || err) window.history.replaceState(null, "", window.location.pathname);
    loadStates();
  }, [loadStates]);

  const connect = async (p: ConnectProvider) => {
    setBusy(p); setNote(null);
    try {
      const r = await fetch(`/api/connect/${p}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirect_uri: `${window.location.origin}/connect-callback` }),
      });
      if (r.status === 503) { setSoon((s) => ({ ...s, [p]: true })); return; }
      if (!r.ok) { setNote(`Couldn't start the ${CONNECT_LABEL[p]} connection. Please try again.`); return; }
      const d = (await r.json()) as { url: string; pending?: string | null };
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: p, pending: d.pending ?? null }));
      window.location.href = d.url; // finishes at /connect-callback
    } catch {
      setNote("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async (p: ConnectProvider) => {
    setBusy(p); setNote(null);
    try {
      const r = await fetch(`/api/connect/${p}/sync`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { added?: number; updated?: number; error?: string };
      if (!r.ok) { setNote(`${CONNECT_LABEL[p]} sync failed (${d.error ?? r.status}). Try again in a minute.`); return; }
      setNote(`${CONNECT_LABEL[p]} sync complete — ${d.added ?? 0} added, ${d.updated ?? 0} updated.`);
      loadStates();
    } catch {
      setNote("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (p: ConnectProvider) => {
    setBusy(p); setNote(null);
    try {
      const r = await fetch(`/api/connect/${p}/disconnect`, { method: "POST" });
      if (!r.ok) { setNote(`Couldn't disconnect ${CONNECT_LABEL[p]}. Please try again.`); return; }
      setNote(`${CONNECT_LABEL[p]} disconnected. Your imported films stay in your library.`);
      setConns((prev) => { const next = { ...prev }; delete next[p]; return next; });
    } catch {
      setNote("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="iw-tiles-divider"><span>Auto-sync</span></div>
      {note && <p className="iw-connect-note" role="status">{note}</p>}
      <div className="iw-tiles iw-tiles-oauth" role="list">
        {CONNECT_PROVIDERS.map((p) => {
          const row = conns[p];
          const connected = rpcOk === true && row && row.status !== "revoked";
          const comingSoon = rpcOk === false || soon[p];
          return (
            <div key={p} role="listitem" className={`iw-tile iw-tile-oauth${connected ? " on" : ""}`}>
              <span className="t">{CONNECT_LABEL[p]}</span>
              {connected ? (
                <>
                  <span className="f">
                    Connected
                    {row.last_sync_at
                      ? ` · last sync ${new Date(row.last_sync_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : " · not synced yet"}
                    {row.status === "error" ? " · needs attention" : ""}
                  </span>
                  <span className="iw-tile-actions">
                    <button type="button" className="iw-linkbtn" disabled={busy === p} onClick={() => syncNow(p)}>
                      {busy === p ? "Syncing…" : "Sync now"}
                    </button>
                    <button type="button" className="iw-linkbtn dim" disabled={busy === p} onClick={() => disconnect(p)}>
                      Disconnect
                    </button>
                  </span>
                </>
              ) : comingSoon ? (
                <span className="f">{COMING_SOON}</span>
              ) : (
                <span className="iw-tile-actions">
                  <button type="button" className="iw-linkbtn" disabled={busy === p || rpcOk === null} onClick={() => connect(p)}>
                    {busy === p ? "Opening…" : "Connect"}
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
