"use client";
/** 노트 · 글쓰기 — 비평 컴포저. Ported from mockup-me-write.html.
 *  REAL data: drafts list = me_authored_takes() (the user's own written takes; currently none →
 *  honest empty state). Attach search = film_search() RPC (live). Framework picker = lib/frameworks
 *  FRAMEWORKS (the 14 Strong-Misreading frameworks). The composer edits an in-session draft; there is
 *  no user-authorship insert path into `takes` yet, so save/publish is a local draft action and this
 *  is stated in the UI (저장 파이프라인 형성 중). "취향 boost ×1.5" note preserved (Phase 2). */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";
import { FRAMEWORKS, FAMILIES, fw, type Framework } from "@/lib/frameworks";

export type TakeRow = {
  take_id: string;
  title: string | null;
  framework: string | null;
  register: string | null;
  body: string | null;
  status: string | null;
  is_public: boolean;
  film_slug: string | null;
  film_title: string | null;
  figure_slug: string | null;
  figure_label: string | null;
  meta_take_slug: string | null;
  meta_take_title: string | null;
  upvotes: number | null;
  created_at: string;
};

type ComposerType = "free" | "comment" | "misreading" | "trope";
type FilmHit = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };
type AttachedFilm = { slug: string; title: string; year: number | null };

const TYPE_META: Record<ComposerType, { label: string; icon: string; tag: string; title: string }> = {
  free: { label: "자유 글", icon: "ti-note", tag: "", title: "영화에 매이지 않는 자유로운 글" },
  comment: { label: "영화 코멘트", icon: "ti-message", tag: "com", title: "특정 영화 아래에 달리는 짧은 코멘트" },
  misreading: { label: "강한 오독", icon: "ti-quote", tag: "mis", title: "figure(형상)을 의도적으로 다르게 읽는 해석" },
  trope: { label: "트로프 기여", icon: "ti-affiliate", tag: "tro", title: "여러 영화를 가로지르는 트로프(패턴)에 기여" },
};
const PH: Record<ComposerType, string> = {
  free: "여기에 take를 씁니다. 영화에 매이지 않아도 됩니다 — 쓰고 나서 오른쪽 첨부 레일에서 영화·framework·트로프를 엮으세요.",
  comment: "이 영화를 보고 떠오른 한 가지. 특정 영화 아래에 짧게 달립니다 — 오른쪽에서 영화를 엮으세요.",
  misreading: "이 형상을 '틀리게' 읽어봅니다. 작품의 의도를 거슬러, 당신만의 해석을 밀어붙이세요.",
  trope: "여러 영화에서 반복되는 한 패턴을 짚습니다. 어떤 작품들이 한 갈래로 묶이는지 쓰세요.",
};

// A composer draft (in-session). Seeded from a real authored take when one is selected.
type Draft = {
  id: string;
  type: ComposerType;
  title: string;
  body: string;
  pub: boolean;
  films: AttachedFilm[];
  framework: string | null;   // key from FRAMEWORKS
  register: string | null;
  fromTakeId: string | null;  // real take backing this draft, if any
};

function newDraft(): Draft {
  return { id: `d-${Date.now()}`, type: "free", title: "", body: "", pub: false, films: [], framework: null, register: null, fromTakeId: null };
}
function draftFromTake(t: TakeRow): Draft {
  const type: ComposerType = t.figure_slug ? "misreading" : t.meta_take_slug ? "trope" : t.film_slug ? "comment" : "free";
  return {
    id: t.take_id, type, title: t.title ?? "", body: t.body ?? "", pub: t.is_public, framework: t.framework,
    register: t.register,
    films: t.film_slug && t.film_title ? [{ slug: t.film_slug, title: t.film_title, year: null }] : [],
    fromTakeId: t.take_id,
  };
}

function plain(html: string) { return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

export default function WriteWorkspace({ takes }: { takes: TakeRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const supabase = useMemo(() => createClient(), []);

  const [drafts, setDrafts] = useState<Draft[]>(() => takes.length ? [] : [newDraft()]);
  const [curId, setCurId] = useState<string | null>(drafts[0]?.id ?? null);
  const [listQ, setListQ] = useState("");
  const [listFilt, setListFilt] = useState<"all" | "pub" | "pri">("all");
  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");
  const [boostDismissed, setBoostDismissed] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  // The full merged list of note items: real authored takes + any new in-session drafts.
  const listItems = useMemo(() => {
    const takeItems = takes.map((t) => ({ id: t.take_id, title: t.title ?? "제목 없는 글", pub: t.is_public, snippet: plain(t.body ?? ""), type: (t.figure_slug ? "misreading" : t.meta_take_slug ? "trope" : t.film_slug ? "comment" : "free") as ComposerType, date: t.created_at, real: true }));
    const draftItems = drafts.filter((d) => !d.fromTakeId).map((d) => ({ id: d.id, title: d.title || "제목 없는 글", pub: d.pub, snippet: plain(d.body), type: d.type, date: null as string | null, real: false }));
    return [...draftItems, ...takeItems].filter((it) => {
      if (listFilt === "pub" && !it.pub) return false;
      if (listFilt === "pri" && it.pub) return false;
      if (listQ && !(it.title + it.snippet).toLowerCase().includes(listQ.toLowerCase())) return false;
      return true;
    });
  }, [takes, drafts, listFilt, listQ]);

  const cur: Draft | null = useMemo(() => drafts.find((d) => d.id === curId) ?? null, [drafts, curId]);

  const patchCur = useCallback((p: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.id === curId ? { ...d, ...p } : d)));
    setSaveState("saving");
  }, [curId]);

  useEffect(() => { if (saveState === "saving") { const t = setTimeout(() => setSaveState("idle"), 650); return () => clearTimeout(t); } }, [saveState, cur?.body, cur?.title]);

  const selectItem = (id: string, real: boolean) => {
    if (real) {
      // hydrate a draft view from the real take (edit is in-session; persistence forming)
      const t = takes.find((x) => x.take_id === id);
      if (t) {
        setDrafts((ds) => (ds.some((d) => d.id === id) ? ds : [...ds, draftFromTake(t)]));
        setCurId(id);
      }
    } else {
      setCurId(id);
    }
  };

  const addDraft = () => { const d = newDraft(); setDrafts((ds) => [...ds, d]); setCurId(d.id); };

  // keep contenteditable in sync when switching drafts
  useEffect(() => { if (bodyRef.current && cur) bodyRef.current.innerHTML = cur.body || ""; }, [curId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCmd = (cmd: string) => {
    bodyRef.current?.focus();
    try {
      if (cmd === "bold") document.execCommand("bold");
      else if (cmd === "italic") document.execCommand("italic");
      else if (cmd === "h2") document.execCommand("formatBlock", false, "h2");
      else if (cmd === "quote") document.execCommand("formatBlock", false, "blockquote");
      else if (cmd === "link") { const u = prompt("링크 URL"); if (u) document.execCommand("createLink", false, u); }
    } catch { /* execCommand best-effort */ }
    if (bodyRef.current) patchCur({ body: bodyRef.current.innerHTML });
  };

  // ── attach/connect inspector rail ──
  const InspRail = useCallback((d: Draft) => {
    return <AttachRail
      draft={d}
      onAddFilm={(f) => setDrafts((ds) => ds.map((x) => x.id === d.id ? { ...x, films: x.films.some((y) => y.slug === f.slug) ? x.films : [...x.films, f] } : x))}
      onRmFilm={(slug) => setDrafts((ds) => ds.map((x) => x.id === d.id ? { ...x, films: x.films.filter((y) => y.slug !== slug) } : x))}
      onFramework={(k) => setDrafts((ds) => ds.map((x) => x.id === d.id ? { ...x, framework: x.framework === k ? null : k, type: x.type === "free" ? "misreading" : x.type } : x))}
      supabase={supabase}
    />;
  }, [supabase]);

  useEffect(() => {
    if (cur) insp.select(InspRail(cur), "첨부 · 연결");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, InspRail]);

  useEffect(() => {
    setDefault(
      <div className="icard"><h4><i className="ti ti-paperclip" /> 첨부 · 연결</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.6 }}>글을 선택하거나 새로 시작하면 여기서 영화·framework·트로프를 엮을 수 있습니다.</div>
      </div>
    );
  }, [setDefault]);

  const routeLabel = (d: Draft) => {
    if (d.type === "comment" && d.films.length) return `· 「${d.films[0].title}」 페이지로`;
    if (d.type === "misreading" && d.framework) return `· ${fw(d.framework).label} 오독으로`;
    return "· 내 프로필에 공개";
  };

  return (
    <div className="composer wr-wrap">
      {/* NOTE LIST */}
      <aside className="nlist">
        <div className="nlhd">
          <div className="wr-srch"><i className="ti ti-search" /><input value={listQ} onChange={(e) => setListQ(e.target.value)} placeholder="내 take 검색" /></div>
          <button className="newbtn" onClick={addDraft} title="새 글 쓰기"><i className="ti ti-plus" /> 새 글</button>
        </div>
        <div className="nlfilt">
          {(["all", "pub", "pri"] as const).map((f) => (
            <button key={f} className={listFilt === f ? "on" : ""} onClick={() => setListFilt(f)}>{f === "all" ? "전체" : f === "pub" ? "공개" : "초안"}</button>
          ))}
        </div>
        <div className="nlitems">
          {listItems.length ? listItems.map((it) => (
            <div key={it.id} className={`li${it.id === curId ? " on" : ""}`} onClick={() => selectItem(it.id, it.real)}>
              <div className="lt"><span className={`vis ${it.pub ? "pub" : "pri"}`}><i className={`ti ${it.pub ? "ti-world" : "ti-lock"}`} /></span>{it.title}</div>
              <div className="sn">{it.snippet || "…"}</div>
              <div className="lm">
                <span className={`wr-ttag ${TYPE_META[it.type].tag}`}>{TYPE_META[it.type].label}</span>
                <span className="wr-ttag boost">×1.5</span>
                {it.date ? <span className="ld">{new Date(it.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</span> : <span className="ld">초안</span>}
              </div>
            </div>
          )) : (
            <div className="nlempty">
              {takes.length === 0
                ? <>아직 작성한 take가 없습니다.<br />「새 글」로 첫 비평을 써 보세요 — 내가 쓴 글은 취향 신호가 가장 강합니다.</>
                : "이 필터에 맞는 글이 없습니다."}
            </div>
          )}
        </div>
      </aside>

      {/* EDITOR */}
      <section className="ed">
        <div className="edbar">
          <div className="wr-seg">
            {(Object.keys(TYPE_META) as ComposerType[]).map((t) => (
              <button key={t} className={cur?.type === t ? "on" : ""} title={TYPE_META[t].title} onClick={() => patchCur({ type: t })} disabled={!cur}>
                <i className={`ti ${TYPE_META[t].icon}`} /> {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <span className={`autosave${saveState === "saving" ? " saving" : ""}`}>
            <i className={`ti ${saveState === "saving" ? "ti-loader-2" : "ti-cloud-check"}`} /> {saveState === "saving" ? "저장 중…" : "자동저장됨(세션)"}
          </span>
          <span className={`wr-pubpill${cur?.pub ? " on" : ""}`} role="switch" aria-checked={!!cur?.pub} tabIndex={0}
            onClick={() => cur && patchCur({ pub: !cur.pub })}
            onKeyDown={(e) => { if (cur && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); patchCur({ pub: !cur.pub }); } }}
            title="공개 시 프로필·영화 페이지에 노출됩니다">
            <i className={`ti ${cur?.pub ? "ti-world" : "ti-lock"}`} />{cur?.pub ? "공개 중" : "비공개"}
          </span>
          <button className={`savebtn${cur?.pub ? " pub" : ""}`} onClick={() => { if (bodyRef.current && cur) patchCur({ body: bodyRef.current.innerHTML }); }}>
            <i className={`ti ${cur?.pub ? "ti-world" : "ti-check"}`} />
            {cur?.pub ? <>게시 <span className="where">{cur ? routeLabel(cur) : ""}</span></> : "초안 저장"}
          </button>
        </div>

        <div className="wr-canvas">
          <div className="inner">
            {!boostDismissed ? (
              <div className="boostbanner">
                <i className="ti ti-flame flame" />
                <span>내가 직접 쓴 해석은 <b>취향 신호 최강</b> — 이 글의 임베딩이 <b>취향 벡터에 ×1.5 boost로 가산</b>됩니다. 별점·관람보다 강하게 당신의 취향을 형성합니다.</span>
                <i className="ti ti-x bx" onClick={() => setBoostDismissed(true)} title="이 안내 접기" />
              </div>
            ) : null}

            {cur && cur.type !== "free" ? (
              <div className="hintbanner">
                {cur.type === "misreading" ? <><b>강한 오독</b> — framework(해석 프레임)을 골라 의도를 거슬러 읽습니다. {cur.framework ? <>「<b>{fw(cur.framework).label}</b>」 프레임으로 게시됩니다.</> : "오른쪽 첨부 레일에서 framework를 고르세요."}</>
                  : cur.type === "comment" ? <><b>영화 코멘트</b> — 특정 영화 아래 짧게 달립니다. {cur.films.length ? <>「<b>{cur.films[0].title}</b>」 페이지에 노출됩니다.</> : "오른쪽에서 영화를 엮으세요."}</>
                    : <><b>트로프 기여</b> — 여러 영화를 가로지르는 패턴에 기여합니다. 오른쪽에서 영화들을 엮으세요.</>}
              </div>
            ) : null}

            {cur ? (
              <>
                <input className="titlein" value={cur.title} onChange={(e) => patchCur({ title: e.target.value })} placeholder="제목 없는 글 — 여기서부터 바로 쓰기 시작" />
                <div className="fmtbar">
                  {([["bold", "ti-bold"], ["italic", "ti-italic"], ["h2", "ti-heading"], ["quote", "ti-blockquote"], ["link", "ti-link"]] as const).map(([cmd, ic]) => (
                    <button key={cmd} onMouseDown={(e) => { e.preventDefault(); applyCmd(cmd); }} title={cmd}><i className={`ti ${ic}`} /></button>
                  ))}
                </div>
                <div className="bodyed" ref={bodyRef} contentEditable suppressContentEditableWarning
                  data-ph={PH[cur.type]}
                  onInput={(e) => patchCur({ body: (e.target as HTMLDivElement).innerHTML })} />
                <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 10, lineHeight: 1.5 }}>
                  <i className="ti ti-info-circle" /> 편집은 현재 세션에 유지됩니다 — 사용자 take를 영구 저장·게시하는 파이프라인은 형성 중입니다.
                </div>
              </>
            ) : (
              <div style={{ padding: "60px 0", textAlign: "center", color: "var(--sub)" }}>
                <i className="ti ti-feather" style={{ fontSize: 34, color: "var(--faint)" }} />
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--mut)" }}>왼쪽에서 글을 고르거나 「새 글」을 시작하세요.</div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── inspector: attach/connect rail ──
function AttachRail({
  draft, onAddFilm, onRmFilm, onFramework, supabase,
}: {
  draft: Draft;
  onAddFilm: (f: AttachedFilm) => void;
  onRmFilm: (slug: string) => void;
  onFramework: (key: string) => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FilmHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFw, setShowFw] = useState(false);

  useEffect(() => {
    if (!searching) return;
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    let alive = true;
    setLoading(true);
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 8 });
      if (alive) { setHits((data as FilmHit[] | null) ?? []); setLoading(false); }
    }, 220);
    return () => { alive = false; clearTimeout(h); };
  }, [q, searching, supabase]);

  const strength = draft.pub ? 92 : 78;

  return (
    <div>
      <div className="icard"><h4><i className="ti ti-paperclip" /> 이 글에 엮은 엔티티</h4>

        {/* films */}
        <div className="arow">
          <div className="arlbl"><span className="d" style={{ background: "var(--film)" }} />영화 (film)<span className="ct">{draft.films.length}</span></div>
          <div className="achips">
            {draft.films.map((f) => (
              <span className="achip film" key={f.slug}>{f.title}{f.year ? <span className="yr">&apos;{String(f.year).slice(2)}</span> : null}<i className="ti ti-x x" onClick={() => onRmFilm(f.slug)} /></span>
            ))}
            {searching ? (
              <span className="asrch">
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="영화 제목" onBlur={() => setTimeout(() => setSearching(false), 180)} />
                <div className="adrop">
                  {loading ? <div className="ai busy">검색 중…</div>
                    : hits.filter((h) => !draft.films.some((f) => f.slug === h.slug)).length
                      ? hits.filter((h) => !draft.films.some((f) => f.slug === h.slug)).map((h) => (
                        <div className="ai" key={h.slug} onMouseDown={(e) => { e.preventDefault(); onAddFilm({ slug: h.slug, title: h.title, year: h.year }); setQ(""); }}>
                          {h.title}<div className="m">{[h.director, h.year].filter(Boolean).join(" · ")}</div>
                        </div>))
                      : <div className="ai busy">{q.trim() ? "결과 없음" : "제목을 입력하세요"}</div>}
                </div>
              </span>
            ) : (
              <span className="addbtn" onClick={() => { setSearching(true); setQ(""); }}><i className="ti ti-plus" /> 영화 엮기</span>
            )}
          </div>
        </div>

        {/* framework (misreading frame) */}
        <div className="arow">
          <div className="arlbl"><span className="d" style={{ background: "var(--misread)" }} />프레임 (framework)<span className="ct">{draft.framework ? 1 : 0}</span></div>
          <div className="achips">
            {draft.framework ? (
              <span className="achip misread">{fw(draft.framework).label}<i className="ti ti-x x" onClick={() => onFramework(draft.framework!)} /></span>
            ) : null}
            <span className="addbtn" onClick={() => setShowFw((s) => !s)}><i className="ti ti-quote" /> {draft.framework ? "프레임 변경" : "framework로 강한 오독 만들기"}</span>
          </div>
          {showFw ? (
            <div style={{ marginTop: 8 }}>
              {FAMILIES.map((fam) => {
                const fws = FRAMEWORKS.filter((f) => f.family === fam.key && f.key !== "INVITATION");
                if (!fws.length) return null;
                return (
                  <div key={fam.key}>
                    <div className="fwfam">{fam.label}</div>
                    <div className="fwpick">
                      {fws.map((f: Framework) => (
                        <button key={f.key} className={`fwchip${draft.framework === f.key ? " on" : ""}`}
                          style={draft.framework === f.key ? { background: f.color, borderColor: f.color } : undefined}
                          onClick={() => { onFramework(f.key); setShowFw(false); }} title={f.short}>
                          <span className="d" style={{ background: f.color }} />{f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="legend-mini">
          <span><i style={{ background: "var(--film)" }} />영화</span>
          <span><i style={{ background: "var(--misread)" }} />프레임</span>
          <span><i style={{ background: "var(--trope)" }} />트로프</span>
          <span><i style={{ background: "var(--figure)" }} />형상</span>
        </div>
      </div>

      {/* taste contribution */}
      <div className="icard"><h4><i className="ti ti-flame" style={{ color: "var(--red)" }} /> 이 글의 취향 기여</h4>
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>내가 직접 쓴 해석은 <b style={{ color: "#f2a39f" }}>취향 신호 최강</b>. 별점·관람보다 강하게 작동합니다.</div>
        <div className="kv" style={{ marginTop: 8 }}><span>취향 벡터 boost</span><b style={{ color: "#f2a39f" }}>×1.5</b></div>
        <div className="kv"><span>임베딩 직접 가산</span><b style={{ color: "var(--safe)" }}>+ 본문</b></div>
        <div className="kv"><span>가시성</span><b style={{ color: draft.pub ? "var(--safe)" : "var(--sub)" }}>{draft.pub ? "공개" : "비공개"}</b></div>
        <div className="crow" style={{ marginTop: 8 }}>
          <span className="cl">기여 강도</span>
          <span className="cbar"><i style={{ width: `${strength}%`, background: "var(--red)" }} /></span>
          <span className="cvv">{strength}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 7 }}>taste_vector += 1.5 · embed(take) — meta_takes에서 직접 가산 (Phase 2)</div>
      </div>

      {/* posting routing */}
      <div className="icard"><h4><i className="ti ti-tags" /> 게시 라우팅</h4>
        <div className="reasons">
          {draft.framework ? <span className="rsn reading">framework {fw(draft.framework).label}</span> : null}
          {draft.films.length ? <span className="rsn frontier">film {draft.films.length}</span> : null}
          {draft.type === "misreading" ? <span className="rsn gap">강한 오독</span> : null}
          {!draft.framework && !draft.films.length ? <span style={{ color: "var(--sub)", fontSize: 11 }}>아직 엮인 엔티티 없음 — 위에서 추가하세요.</span> : null}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>유형·엔티티에 따라 글이 영화 페이지·framework·트로프 라인으로 라우팅됩니다.</div>
      </div>
    </div>
  );
}
