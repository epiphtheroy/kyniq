"use client";
/** Cinecodex 평가 카드 — engine ⑨ full breakdown (mockup-me-film-cinecodex fidelity).
 *  All numbers real (cinecodex_card RPC): V/C/R/U/S, 13 subs, per-sub nearest comparison
 *  films, reliability, external, standing. Level bands + aesthetic ladder are a DEFINED rubric
 *  (not invented per-film prose). Never-blend triptych: 우리 ≠ 외부 ≠ 정전. */
import { useState } from "react";

type Comps = Record<string, string[] | null>;
export type CardData = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  v: number; c: number; r: number; u: number; s: number;
  subs: Record<string, number>; comps: Comps | null;
  reliability: { n_samples: number | null; sd_v: number | null; sd_r: number | null; panel: string | null; prompt_version: string | null; flagged: boolean | null; scored_at: string | null };
  conf: number | null; tier: string | null; n_takes: number | null;
  ext: { imdb: number | null; rt: number | null; meta: number | null } | null;
  standing: { prestige: number | null; labels: string[] | null };
  basket: { title: string; slug: string; u: number; r: number; self: boolean }[] | null;
};

const IMG = "https://image.tmdb.org/t/p/w185";
const AES = ["기본기", "견실한 장인정신", "사려 깊은 작품", "성취된 작품", "뚜렷한 비전", "지속된 성취", "주요작", "촉발된 사색", "초월적", "정전의 정점"];
const BAND = {
  v: ["미약", "준수", "견실", "강력", "탁월"],
  c: ["진입 쉬움", "중급", "까다로움", "상급", "전문 지식"],
  r: ["없음", "낮음", "일부", "높음", "심각"],
};
const AXDESC = { v: "획득가치(돌려주는 것)에 기여", c: "진입 비용 — 난이도이지 가치 아님", r: "실망 위험 신호 — 낮을수록 안전" };
type Axis = "v" | "c" | "r";
const SUBS: { code: string; key: string; nm: string; axis: Axis }[] = [
  { code: "COG · 인지", key: "cog", nm: "인지적 자극", axis: "v" },
  { code: "AFF · 정서", key: "aff", nm: "정서적 강도", axis: "v" },
  { code: "FORM · 형식", key: "form", nm: "형식적 성취", axis: "v" },
  { code: "MORAL · 도덕", key: "moral", nm: "도덕적 진지성", axis: "v" },
  { code: "DUR · 지속", key: "dur", nm: "지속적 잔상", axis: "v" },
  { code: "ITX · 영화사", key: "itx", nm: "상호텍스트성", axis: "c" },
  { code: "FR · 형식급진", key: "fr", nm: "형식적 급진성", axis: "c" },
  { code: "ETX · 외부지식", key: "etx", nm: "외부텍스트성", axis: "c" },
  { code: "CTX · 오에브르", key: "ctx", nm: "감독 오에브르", axis: "c" },
  { code: "BANK · 지적파산", key: "bank", nm: "지적 파산", axis: "r" },
  { code: "INSINCERE · 불성실", key: "insincere", nm: "미적 불성실", axis: "r" },
  { code: "COWARD · 비겁", key: "coward", nm: "예술적 비겁", axis: "r" },
  { code: "POLAR · 분열성", key: "polar", nm: "분열성", axis: "r" },
];
const lvOf = (val: number) => Math.max(1, Math.min(5, Math.round(val / 20)));
function heat(axis: Axis, lv: number): string {
  if (axis === "v") return lv >= 4 ? "g" : lv === 3 ? "m" : "n";
  if (axis === "c") return lv <= 1 ? "g" : lv === 2 ? "n" : "m";
  return lv <= 1 ? "g" : lv === 2 ? "n" : lv === 3 ? "m" : "b";
}

function Donut({ val, color, label, of }: { val: number; color: string; label: React.ReactNode; of: string }) {
  const C = 2 * Math.PI * 34;
  const off = C * (1 - Math.max(0, Math.min(100, val)) / 100);
  return (
    <div className="donutcell">
      <svg width="86" height="86" viewBox="0 0 86 86">
        <circle cx="43" cy="43" r="34" fill="none" stroke="#24242a" strokeWidth="7" />
        <circle cx="43" cy="43" r="34" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 43 43)" />
        <text x="43" y="40" textAnchor="middle" fontSize="20" fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{Math.round(val)}</text>
        <text x="43" y="54" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1">/100</text>
      </svg>
      <div className="cap">{label}</div>
      <div className="note">{of}</div>
    </div>
  );
}

export default function EvalCard({ d }: { d: CardData }) {
  const [subsOpen, setSubsOpen] = useState(true);
  const [relOpen, setRelOpen] = useState(false);
  const v = Math.round(d.v), c = Math.round(d.c), r = Math.round(d.r);
  const al = Math.max(1, Math.min(10, Math.round(d.v / 10)));
  const polar = d.subs.polar ?? 0;
  const pBand = polar < 20 ? "저" : polar < 40 ? "중" : "고";
  const pr = d.standing.prestige;
  const hiV = v >= 72, loR = r <= 20;
  const verdict = hiV && loR ? "높은 가치 · 낮은 위험 — 안전한 걸작." : hiV && !loR ? "높은 가치 · 높은 위험 — 야심적이나 분열적." : !hiV && loR ? "견고하나 절정은 아님 — 안정적 선택." : "가치·위험 모두 중간 — 신중히 접근.";
  const tierLabel = pr == null ? "—" : pr >= 85 ? "세계정전" : pr >= 70 ? "국가정전" : pr >= 50 ? "주목" : "—";
  const nomerge = pr == null ? "정전가 미산정." : pr < v - 8 ? `정전 ${pr} < 우리 V ${v} — 시장이 아직 저평가한 것을 펀더멘털이 포착.` : pr > v + 8 ? `정전 ${pr} > 우리 V ${v} — 시장은 높게 평가; 펀더멘털은 더 신중.` : `정전 ${pr} ≈ 우리 V ${v} — 시장과 펀더멘털이 정합.`;
  const rel = d.reliability;

  const group = (axis: Axis, title: string, sub: string) => (
    <div key={axis}>
      <div className="grp"><span className={`ax ${axis}`}>→ {title}</span><span>{sub}</span><span className="line" /></div>
      {SUBS.filter((s) => s.axis === axis).map((s) => {
        const val = d.subs[s.key] ?? 0; const lv = lvOf(val); const h = heat(axis, lv);
        const comps = d.comps?.[s.key] ?? [];
        return (
          <div className="sub" key={s.key}>
            <div className="snm"><div className="code">{s.code}</div><div className="nm">{s.nm}</div><div className="lv">L{lv} · {BAND[axis][lv - 1]}</div></div>
            <div>
              <div className="rsn2">{BAND[axis][lv - 1]} — {AXDESC[axis]}.</div>
              {comps.length ? <div className="comps">{comps.map((cf, i) => <span className="cmp" key={i}>{cf}</span>)}</div> : null}
            </div>
            <div className="lvcell"><div className={`lvn ${h}`}>{lv}</div><div className="lvd">/5</div></div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mainpad ec-wrap">
      {/* HERO */}
      <div className="fhero">
        <div className="fposter" style={d.poster_path ? { backgroundImage: `url(${IMG}${d.poster_path})` } : {}} />
        <div className="fmeta">
          <div className="ftitle">{d.title} {d.year ? <small>{d.year}</small> : null}</div>
          <div className="fsub">{[d.year, d.director, ...(d.standing.labels ?? [])].filter(Boolean).join(" · ")}</div>
          <div className="fbadges">
            <span className="tierbadge"><i className="ti ti-award" /><span className="lv">L{al}</span> {AES[al - 1]} <span className="of">/ 10 미적 단계</span></span>
            <span className="polarbadge"><i className="ti ti-git-branch" style={{ fontSize: 11 }} /> 분열성 {pBand} · POLAR {pBand}</span>
            {rel.flagged ? <span className="flagchip"><i className="ti ti-flag" /> flagged · n={rel.n_samples ?? 1}</span> : null}
          </div>
        </div>
        <div className="axisgrid">
          <Donut val={d.v} color="var(--safe)" label={<><b>V</b> 획득가치</>} of="돌려주는 것 · 높을수록 ↑" />
          <Donut val={d.c} color="var(--frontier)" label={<><b>C</b> 진입비용</>} of="난이도 · 가치 아님" />
          <Donut val={d.r} color="var(--risk)" label={<><b>R</b> 위험도</>} of={r <= 20 ? "저위험 · 안전" : "주의"} />
          <div className="uscell">
            <div className="usbig"><span className="n" style={{ color: "var(--safe)" }}>{d.u}</span>
              <span className="lab"><span className="k">U 영화 순가치</span><span className="d">= V {v} − λ·R (λ 1.0)</span></span></div>
            <div className="usrow"><span className="n">{d.s.toFixed(2)}</span><span className="lab">S 샤프 · 위험 대비 효율</span></div>
          </div>
          <div className="verdict"><i className="ti ti-shield-check" />
            <div>한 줄 판정 · <b>{verdict}</b> <span style={{ color: "var(--sub)" }}> L{al}「{AES[al - 1]}」 단계 · 진입비용 C {c} — {c < 40 ? "접근성 양호" : "준비 필요"}. 미적 단계는 V의 질적 레이어 — 점수와 별개로 읽을 것.</span></div>
          </div>
        </div>
      </div>

      {/* 13 SUBS */}
      <div className={`mod${subsOpen ? "" : " closed"}`}>
        <div className="modh clk" onClick={() => setSubsOpen((o) => !o)}>
          <h3><i className="ti ti-list-numbers" /> 13 서브점수 · 차원 분해</h3>
          <span className="meta">각 레벨 + 근거 + 비교작 3(실측 근접)</span>
          <i className="ti ti-chevron-down cx" />
        </div>
        <div className="modbody">
          {group("v", "V 획득가치", "Cognition · Affect · Form · Moral · Duration")}
          {group("c", "C 진입비용", "Intertext · Formal Radicalism · Extratext · Oeuvre")}
          {group("r", "R 위험도", "Bankruptcy · Insincerity · Cowardice · Polarization")}
          <div className="formula"><i className="ti ti-function" style={{ color: "var(--canon)" }} /> V = mean(COG·AFF·FORM·MORAL·DUR) → <b style={{ color: "#5fd0b2" }}>{v}</b> · C = mean(ITX·FR·ETX·CTX) → <b style={{ color: "#86b9ec" }}>{c}</b> · R = 0.6·mean(BANK·INSINCERE·COWARD) + 0.4·POLAR → <b style={{ color: "#e3a3cf" }}>{r}</b>. 난이도(C)는 <b style={{ color: "var(--mut)" }}>비용이지 가치 아님</b> · 분열성(POLAR)은 <b style={{ color: "var(--mut)" }}>위험이지 불신뢰 아님</b>. 비교작은 해당 차원 <b style={{ color: "var(--mut)" }}>실측 근접 3편</b>.</div>
        </div>
      </div>

      {/* TRIPTYCH */}
      <div className="mod">
        <div className="modh"><h3><i className="ti ti-columns-3" /> 나란히 · 세 개의 기둥 <span style={{ color: "var(--sub)", fontWeight: 400 }}>(★★★ 절대 안 섞음)</span></h3><span className="meta">우리 ≠ 외부 ≠ 정전</span></div>
        <div className="modbody">
          <div className="triptych">
            <div className="tcol ours"><div className="thd"><i className="ti ti-microscope" /> 우리 · Cinecodex <span className="tag">펀더멘털</span></div>
              <div className="tmetric"><span className="mk">V 획득가치</span><span className="mv" style={{ color: "#5fd0b2" }}>{v}</span></div>
              <div className="tmetric"><span className="mk">R 위험도</span><span className="mv" style={{ color: "var(--risk)" }}>{r}</span></div>
              <div className="tmetric"><span className="mk">U 영화 순가치</span><span className="mv" style={{ color: "#5fd0b2" }}>{d.u}</span></div>
              <div className="foot">LLM이 13차원 루브릭으로 채점한 <b style={{ color: "var(--mut)" }}>작품 펀더멘털</b>. 외부지표·정전가를 공식에 넣지 않음.</div></div>
            <div className="tcol ext"><div className="thd"><i className="ti ti-world" /> 외부 지표 <span className="tag">집계</span></div>
              <div className="tmetric"><span className="mk">IMDb</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.imdb ?? "—"}<small>/10</small></span></div>
              <div className="tmetric"><span className="mk">Metacritic</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.meta ?? "—"}<small>/100</small></span></div>
              <div className="tmetric"><span className="mk">Rotten Tomatoes</span><span className="mv" style={{ color: "#86b9ec" }}>{d.ext?.rt ?? "—"}<small>%</small></span></div>
              <div className="foot">대중·평단 <b style={{ color: "var(--mut)" }}>집계 지표</b>. 참고·검증용 — 우리 점수 산출에 미입력.</div></div>
            <div className="tcol canon"><div className="thd"><i className="ti ti-building-bank" /> 정전 · Standing <span className="tag">시장가</span></div>
              <div className="tmetric"><span className="mk">정전가</span><span className="mv" style={{ color: "#e0bb6e" }}>{pr ?? "—"}</span></div>
              <div className="tmetric"><span className="mk">등재 · 수상</span><span className="mv" style={{ color: "var(--mut)", fontSize: 12 }}>{(d.standing.labels ?? []).slice(0, 2).join("·") || "—"}</span></div>
              <div className="tmetric"><span className="mk">티어</span><span className="mv" style={{ color: "var(--mut)", fontSize: 12 }}>{tierLabel}</span></div>
              <div className="foot">엔진 ② <b style={{ color: "var(--mut)" }}>시장가</b> — "세상이 인정했나". 우리 V(펀더멘털)와 별개 축.</div></div>
          </div>
          <div className="nomerge"><i className="ti ti-arrows-diff" /> 세 칸은 <b style={{ color: "var(--ink)" }}>절대 한 숫자로 합치지 않는다.</b> {nomerge}</div>
        </div>
      </div>

      {/* RELIABILITY */}
      <div className={`mod${relOpen ? "" : " closed"}`}>
        <div className="modh clk" onClick={() => setRelOpen((o) => !o)}>
          <h3><i className="ti ti-shield-check" /> 신뢰도 · 재현성 카드</h3><span className="meta">비결정성 정직 공개</span><i className="ti ti-chevron-down cx" />
        </div>
        <div className="modbody">
          <div className="relgrid">
            <div>
              <div className="ec-kv"><span className="k">panel</span><span className="v">{rel.panel ?? "—"}</span></div>
              <div className="ec-kv"><span className="k">prompt_version</span><span className="v">{rel.prompt_version ?? "—"}</span></div>
              <div className="ec-kv"><span className="k">scored_at</span><span className="v">{rel.scored_at ? String(rel.scored_at).slice(0, 10) : "—"}</span></div>
              <div className="ec-kv"><span className="k">신뢰도 tier</span><span className="v">{d.tier ?? "—"}{d.conf != null ? ` · ${d.conf}` : ""}</span></div>
            </div>
            <div>
              <div className="ec-kv"><span className="k">n_samples</span><span className="v warn">{rel.n_samples ?? "—"}</span></div>
              <div className="ec-kv"><span className="k">sd_v / sd_r</span><span className="v warn">{rel.sd_v != null ? `${rel.sd_v} / ${rel.sd_r}` : "미측정 (N=1)"}</span></div>
              <div className="ec-kv"><span className="k">근거 코퍼스</span><span className="v">{d.n_takes ?? 0} takes</span></div>
              <div className="ec-kv"><span className="k">flagged</span><span className={`v${rel.flagged ? " warn" : ""}`}>{String(!!rel.flagged)}</span></div>
            </div>
          </div>
          <div className="honest"><b>정직한 비결정성 노트.</b> 이 점수는 상용 LLM 단일 샘플(Pass1 N=1)이라 <b>런 노이즈(sd)를 측정하지 못했고</b> flagged 상태다. 재채점 시 각 서브점수는 ±수 점 흔들릴 수 있다 — 오류가 아니라 생성 모델의 본성이다. <b>계산(HOW)은 숨기되 근거(WHY)·신뢰도는 공개</b>한다. <b>flagged ≠ 저품질</b>이며 낮은 분열성(POLAR)은 흐림 사유가 아니다.</div>
          <div className="pass2"><i className="ti ti-repeat" /><span><b>Pass2 N=3 권장.</b> flagged 대상 3-샘플 재채점으로 median 안정화 + sd 확보. 고위험 5%는 Pass3 Opus 감사 권장. 현재 미실행.</span></div>
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2, textAlign: "center" }}>엔진 ⑨ 내재가치 · Cinecodex — 정전가(②)와 나란히 서는 두 번째 객관 축 · 비섞임 단방향</div>
    </div>
  );
}
