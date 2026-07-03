"use client";
/** /room/pair — 동행 (slow pair · 가면무도회 · 하루 한 명 · 자정 KST 회전).
 *  REAL: me_today_pair() — 일자별 결정적 매칭(양방향 일관) · 싱크율 = 두 v_loved 코사인 ·
 *  교집합 앵커/공통 계보만 부분노출(RPC 레벨 강제: 실명·개별 평점·전체 취향·상대 uuid 미반환).
 *  「가면 벗기」= me_pair_reveal() 상호 동의 — 둘 다 벗어야, 그리고 상대가 portfolio_public일 때만
 *  공개 프로필 username이 열린다. 상대가 없으면(휴장/유저 부족) 가짜 파트너를 만들지 않는다.
 *  지난 동행 = me_pair_history() (싱크율·최상위 교집합 앵커만 보존). */
import { useMemo, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";

export type TodayPair = {
  has_partner: boolean;
  reason?: string;                       // forming | ineligible | odd_out
  sync_pct?: number | string | null;
  shared_anchors?: { label: string; films: number }[] | null;
  shared_lineages?: { label: string; films: number }[] | null;
  my_consent?: boolean;
  partner_consent?: boolean;
  revealed?: { username?: string; display_name?: string; public?: boolean } | null;
  loved_n: number;
  forming: boolean;
  candidates: number;
};
export type SigRow = { kind: string; label: string; films: number };
export type PairHist = { day: string; sync_pct: number | string | null; top_anchor: string | null };

const num = (x: number | string | null | undefined): number | null =>
  x == null ? null : typeof x === "number" ? x : Number.isNaN(Number(x)) ? null : Number(x);

function pad(n: number) { return (n < 10 ? "0" : "") + n; }
function kstCountdown() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const next = new Date(kst.getFullYear(), kst.getMonth(), kst.getDate() + 1, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - kst.getTime());
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  return { txt: `${pad(h)}:${pad(m)}:${pad(s)}`, frac: (86400000 - diff) / 86400000 };
}
function kstDateOf(offsetDays: number) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  kst.setDate(kst.getDate() - offsetDays);
  return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}`;
}

export default function PairWorkspace({ initial, sig, hist }: { initial: TodayPair; sig: SigRow[]; hist: PairHist[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const supabase = useMemo(() => createClient(), []);
  const [pair, setPair] = useState<TodayPair>(initial);
  const [cd, setCd] = useState(kstCountdown());
  const [status, setStatus] = useState("");
  const [revealing, setRevealing] = useState(false);

  useEffect(() => { const t = setInterval(() => setCd(kstCountdown()), 1000); return () => clearInterval(t); }, []);

  const anchors = useMemo(() => sig.filter((s) => s.kind === "anchor"), [sig]);
  const lineages = useMemo(() => sig.filter((s) => s.kind === "lineage"), [sig]);
  const hasPartner = pair.has_partner;
  const forming = pair.forming;
  const sync = num(pair.sync_pct);
  const sharedAnchors = pair.shared_anchors ?? [];
  const sharedLineages = pair.shared_lineages ?? [];
  const revealedUser = pair.revealed?.username ?? null;
  const revealedBlocked = pair.revealed != null && pair.revealed.public === false;

  /* 「가면 벗기」 — 내 동의 기록. 상호 동의 + 상대 공개 프로필일 때만 열림 */
  const doReveal = useCallback(async () => {
    if (revealing) return;
    setRevealing(true);
    const { data, error } = await supabase.rpc("me_pair_reveal");
    setRevealing(false);
    if (error) { setStatus(`동의 기록 실패 — ${error.message}`); return; }
    const next = data as TodayPair | null;
    if (next) {
      setPair(next);
      if (next.revealed?.username) setStatus("서로 가면을 벗었습니다 — 공개 프로필이 열립니다.");
      else if (next.revealed && next.revealed.public === false) setStatus("서로 벗었지만, 상대의 프로필이 비공개라 열 수 없습니다 — 규칙대로 여기서 멈춥니다.");
      else if (next.my_consent && !next.partner_consent) setStatus("내 가면을 벗었습니다 — 상대도 벗으면 공개 프로필이 열립니다.");
    }
  }, [supabase, revealing]);

  /* default inspector: 동행 안내 + 부분 노출 규칙 + 내 싱크 가능성(실측 취향) */
  useEffect(() => {
    setDefault(
      <div>
        <div className="icard"><h4><i className="ti ti-masks-theater" /> 동행이란</h4>
          <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>하루 한 명. 취향으로 매칭된 한 사람과, 가면을 쓴 채 하루를 함께 통과합니다.</div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>DM 아님 · 공개 아님 — 「오늘 누구와 통했나」 한 장의 카드. 자정(KST)에 회전.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-shield-lock" /> 가면무도회 · 부분 노출</h4>
          <div className="kv"><span>싱크율 + 교집합 앵커</span><b style={{ color: "var(--safe)" }}>공개</b></div>
          <div className="kv"><span>공통 계보 (제목만)</span><b style={{ color: "var(--safe)" }}>공개</b></div>
          <div className="kv"><span>실명 · 사진</span><b className="masked">비공개</b></div>
          <div className="kv"><span>개별 평점 · 전체 취향</span><b className="masked">비공개</b></div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>부분 노출은 화면이 아니라 <b style={{ color: "var(--mut)" }}>RPC 레벨에서 강제</b>됩니다 — 서버가 실명·개별 평점·전체 취향을 아예 반환하지 않습니다. 「가면 벗기」는 <b style={{ color: "var(--mut)" }}>상호 동의 + 상대의 공개 프로필</b>로만.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-fingerprint" /> 내 싱크 재료 · v_loved</h4>
          {forming ? (
            <div style={{ fontSize: 11.5, color: "var(--forming-tx)", fontStyle: "italic" }}>취향 벡터 형성 중 (loved {pair.loved_n}/8) — 8편부터 매칭 대상에 들어갑니다.</div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--safe)" }}>취향 벡터 확정 · loved {pair.loved_n}편 — 매칭 풀에 들어 있습니다.</div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>싱크 = 두 사람 v_loved 코사인. 벡터 표본이 부족하면 하드 숫자 대신 「형성 중」.</div>
        </div>
      </div>
    );
  }, [setDefault, forming, pair.loved_n]);

  const showSignature = useCallback(() => {
    insp.select(
      <div>
        <div className="backlink" onClick={() => insp.reset()}><i className="ti ti-arrow-left" /> 동행 안내로</div>
        <div className="icard"><h4><i className="ti ti-fingerprint" /> 내 취향 앵커 <span style={{ color: "var(--faint)", fontWeight: 400 }}>· 실측</span></h4>
          {anchors.length ? <div>{anchors.map((a) => <span key={a.label} className="anchorchip" title={`${a.films}편에서 반복`}>{a.label}</span>)}</div>
            : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>앵커 형성 중 — ★4.5+ 작품을 더 평가하세요.</div>}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>동행이 나타나면 이 중 <b style={{ color: "var(--masque-tx)" }}>겹치는 앵커</b>만 교집합으로 노출됩니다.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-affiliate" /> 내 공통 계보 후보</h4>
          {lineages.length ? lineages.map((l) => <div className="kv" key={l.label}><span style={{ fontFamily: "var(--ser)", fontSize: 12.5 }}>{l.label}</span><b>{l.films}편</b></div>)
            : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>계보 형성 중.</div>}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>상대와 겹치는 계보만 「공통 계보」로 남고, 그 외는 가립니다.</div>
        </div>
      </div>, "내 취향 시그니처 · 매칭 재료");
  }, [insp, anchors, lineages]);

  /* 히스토리: 최근 5일 각 날짜에 기록이 있으면 표시 (부분노출 보존) */
  const histByDay = useMemo(() => {
    const m = new Map<string, PairHist>();
    for (const h of hist) m.set(h.day, h);
    return m;
  }, [hist]);

  const revealBtn = () => {
    if (!hasPartner) return <span className="dbtn pri disabled" title="동행 상대가 나타나면 활성화됩니다"><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> 가면 벗기 (상대 대기)</span>;
    if (revealedUser) return <a className="dbtn pri" href={`/u/${revealedUser}`}><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> 공개 프로필 열기 · {pair.revealed?.display_name ?? revealedUser}</a>;
    if (revealedBlocked) return <span className="dbtn pri disabled" title="상대 프로필 비공개 — 규칙상 여기까지"><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> 서로 벗음 · 상대 프로필 비공개</span>;
    if (pair.my_consent) return <span className="dbtn pri disabled" title="상대의 동의를 기다립니다"><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> 내 가면 벗음 · 상대 대기</span>;
    return <span className={`dbtn pri${revealing ? " disabled" : ""}`} onClick={doReveal} title="상호 동의 시에만 공개 프로필이 열립니다"><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> {revealing ? "기록 중…" : "가면 벗기"}</span>;
  };

  return (
    <div className="mainpad">
      <h1 className="secttl">동행 · slow pair · 가면무도회</h1>
      <p className="secsub">하루 한 명. <span className="gloss" title="싱크율 — 두 사람 v_loved 벡터의 코사인 유사도(0–100)">싱크율</span> = 두 사람 <span className="gloss" title="v_loved — 사랑한 영화들로 만든 취향 벡터">v_loved 코사인</span>. 가면무도회는 <b style={{ color: "var(--mut)" }}>교집합 앵커·공통 계보만</b> 보여주고, 실명·개별 평점·전체 취향은 끝까지 가립니다. 자정(KST) 회전.</p>

      {/* HERO */}
      <div className="pair-hero">
        <div className="pair-navbig">
          <div className="pair-ring">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r="38" fill="none" stroke="#24242a" strokeWidth="7" />
              <circle cx="46" cy="46" r="38" fill="none" stroke="var(--masque)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray="239" strokeDashoffset={hasPartner && sync != null ? Math.max(0, Math.round(239 * (1 - sync / 100))) : 239} transform="rotate(-90 46 46)" />
              <text x="46" y="44" textAnchor="middle" fontSize={hasPartner ? "21" : "13"} fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{hasPartner ? (sync != null ? sync : "—") : "대기"}</text>
              <text x="46" y="58" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1.5">{hasPartner ? "싱크" : "상대"}</text>
            </svg>
          </div>
          <div className="pair-navmeta">
            <div className="eb">오늘의 동행 · 가면무도회</div>
            <div className="lvl" style={{ color: "var(--violet)" }}>● {hasPartner ? `오늘의 동행 · 싱크 ${sync != null ? `${sync}%` : "형성 중"}` : pair.reason === "odd_out" ? "오늘은 휴장 · 홀수 인원" : "아직 동행 상대 없음"}</div>
            <div className="pctl">{forming ? `취향 형성 중 · loved ${pair.loved_n}/8 — 8편부터 매칭` : `취향 벡터 확정 · loved ${pair.loved_n}편 준비됨`}</div>
          </div>
        </div>
        <div className="pair-components">
          {anchors.length ? anchors.slice(0, 4).map((a, i) => (
            <div className="pair-comp" key={a.label}>
              <span className="cl" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.label}>{a.label}</span>
              <div className="ct"><i style={{ width: `${Math.min(100, 40 + a.films * 18)}%`, background: i === 0 ? "var(--masque)" : "var(--canon)" }} /></div>
              <span className="cv">{a.films}편</span>
            </div>
          )) : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>취향 앵커 형성 중 — ★4.5+ 작품을 더 평가하면 매칭 재료가 채워집니다.</div>}
        </div>
        <div className="pair-explain"><i className="ti ti-info-circle" /> 싱크율 = 두 사람 <b style={{ color: "var(--mut)" }}>v_loved 코사인</b> — 가면무도회는 <b style={{ color: "var(--mut)" }}>교집합 앵커·공통 계보만</b> 보여줍니다(서버 강제). 실명·개별 평점·전체 취향은 끝까지 가립니다. 자정(KST)에 새 한 명으로 회전.</div>
      </div>

      {/* KPI STRIP */}
      <div className="pair-kpis">
        <div className="pair-kpi"><div className="eb">오늘의 동행</div><div className="v">{hasPartner ? 1 : 0}</div><div className="d flat">{hasPartner ? "매칭됨 · 부분 노출" : `매칭 풀 ${pair.candidates}명`}</div></div>
        <div className="pair-kpi"><div className="eb">싱크율</div><div className="v" style={{ color: "var(--masque)" }}>{hasPartner && sync != null ? `${sync}` : "—"}</div><div className="d flat">v_loved 코사인</div></div>
        <div className="pair-kpi"><div className="eb">교집합 앵커</div><div className="v">{sharedAnchors.length}</div><div className="d up">겹치는 형상</div></div>
        <div className="pair-kpi"><div className="eb">자정 회전</div><div className="v mono" style={{ fontSize: 18 }}>{cd.txt}</div><div className="d flat">KST · 새 한 명</div></div>
        <div className="pair-kpi"><div className="eb">취향 벡터</div><div className="v" style={{ fontSize: 17, color: forming ? "var(--forming)" : "var(--safe)" }}>{forming ? "형성중" : "확정"}</div><div className="d flat">loved {pair.loved_n}편</div></div>
      </div>

      {/* CENTERPIECE · 오늘의 동행 가면무도회 */}
      <div className="pair-mod">
        <div className="pair-modh"><h3><i className="ti ti-masks-theater" /> 오늘의 동행 · 가면무도회</h3>
          <span className="meta">하루 한 명 · 부분 노출 · 자정(KST) 회전</span></div>
        <div className="pair-modbody" style={{ padding: 0 }}>
          <div className="duo">
            <div className="duo-lead"><i className="ti ti-masks-theater" style={{ color: "var(--violet)", fontSize: 17 }} />
              <span className="ttl">{hasPartner ? "오늘 통하는 한 사람" : pair.reason === "odd_out" ? "오늘은 짝이 없는 날입니다" : "아직, 함께 통과할 한 사람이 없습니다"}</span>
              <span className="sub"><i className="ti ti-info-circle" />DM 아님 · 공개 아님</span></div>

            <div className="pair">
              <div className="mask">
                <svg width="76" height="76" viewBox="0 0 76 76"><ellipse cx="38" cy="38" rx="30" ry="34" fill="var(--masque-iris)" stroke="var(--masque)" strokeWidth="1.3" />
                  <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
                  <path d="M24 50 Q38 56 52 50" fill="none" stroke="var(--masque)" strokeWidth="1.2" /></svg>
                <div className="nm">당신</div><div className="rl">{pair.my_consent ? "가면 벗음" : anchors[0]?.label ? "가면 착용" : "형성 중"}</div>
              </div>
              <div className="sync">
                <div className={`pv${hasPartner && sync != null ? "" : " empty"}`}>{hasPartner ? (sync != null ? `${sync}` : "형성 중") : "?"}</div>
                <div className="pl">싱크율</div>
                <div className="fm">v_loved 코사인</div>
              </div>
              <div className="mask">
                {hasPartner ? (
                  <svg width="76" height="76" viewBox="0 0 76 76"><ellipse cx="38" cy="38" rx="30" ry="34" fill="var(--masque-iris)" stroke="var(--masque)" strokeWidth="1.3" />
                    <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
                    <path d="M24 50 Q38 56 52 50" fill="none" stroke="var(--masque)" strokeWidth="1.2" /></svg>
                ) : (
                  <svg width="76" height="76" viewBox="0 0 76 76"><ellipse cx="38" cy="38" rx="30" ry="34" fill="#1c1c20" stroke="var(--sub)" strokeWidth="1.3" strokeDasharray="4 3" />
                    <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
                    <path d="M24 51 Q38 51 52 51" fill="none" stroke="var(--sub)" strokeWidth="1.2" /></svg>
                )}
                <div className="nm">{revealedUser ? (pair.revealed?.display_name ?? revealedUser) : <>상대 {hasPartner ? null : <span style={{ color: "var(--sub)", fontSize: 11 }}>· 빈 가면</span>}</>}</div>
                <div className="rl">{hasPartner ? (revealedUser ? "가면 벗음 · 공개 프로필" : pair.partner_consent ? "가면 벗음 · 내 동의 대기" : "가면 착용") : "아직 아무도 없음"}</div>
              </div>
            </div>

            {hasPartner ? (
              <div className="ident">
                <div className="lbl">두 분의 교집합 · 앵커 (겹치는 것만 — 서버 강제)</div>
                {sharedAnchors.length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 4px" }}>
                    {sharedAnchors.map((a) => <span key={a.label} className="anchorchip" title={`두 사람의 loved ${a.films}편을 가로지름`}>{a.label} <span style={{ color: "var(--sub)" }}>{a.films}</span></span>)}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic", margin: "8px 0 4px" }}>겹치는 해석 앵커가 아직 없습니다 — 취향이 서로 다른 두 사람입니다. 그것도 하나의 답.</div>
                )}
                {sharedLineages.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="lbl">공통 계보 (제목만)</div>
                    {sharedLineages.map((l) => <div className="sigrow" key={l.label}><span className="nm" title={l.label}>{l.label}</span><span className="ct">{l.films}편</span></div>)}
                  </div>
                ) : null}
                <div className="duo-foot">
                  <span>싱크율 <b>{sync != null ? `${sync}%` : "형성 중"}</b></span>
                  <span>교집합 앵커 <b>{sharedAnchors.length}</b></span>
                  <span>공통 계보 <b>{sharedLineages.length}</b></span>
                </div>
              </div>
            ) : (
              <div className="ident">
                <div className="lbl">두 분의 교집합 · 앵커</div>
                <div className="invite">
                  <div className="big">{pair.reason === "odd_out" ? "오늘은 홀수 — 한 사람이 남습니다" : "동행은 두 사람부터 시작됩니다"}</div>
                  <div className="sub">
                    {pair.reason === "odd_out"
                      ? <>매칭 풀 인원이 홀수라 오늘은 짝이 없습니다. 자정(KST)마다 순서가 새로 섞입니다 — 내일은 한 사람이 스쳐갑니다. 가짜 숫자는 만들지 않습니다.</>
                      : <>아직 <b>동행 상대</b>가 없어 싱크율을 계산할 수 없습니다. 다른 관객이 취향 벡터(★4.5+ 8편)를 확정하면, 자정(KST)마다 <b>가장 통하는 한 사람</b>이 가면을 쓴 채 나타납니다. 가짜 숫자는 만들지 않습니다.</>}
                  </div>
                  <div className="seed"><i className="ti ti-seedling" /> {forming ? `내 취향 형성 중 · loved ${pair.loved_n}/8` : `내 취향 준비됨 · loved ${pair.loved_n}편`}</div>
                </div>

                {/* 내 매칭 재료(실측) — 무엇이 매칭될지 정직하게 미리 보기 */}
                <div style={{ marginTop: 15, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div className="lbl">내 매칭 재료 · 무엇이 겹치면 교집합이 되나 (실측)</div>
                  <div className="sigwrap">
                    <div className="sigcard"><h5><i className="ti ti-vector-triangle" /> 내 앵커 (figure_type)</h5>
                      {anchors.length ? anchors.slice(0, 5).map((a) => (
                        <div className="sigrow" key={a.label}><span className="nm" title={a.label}>{a.label}</span><span className="ct">{a.films}편</span></div>
                      )) : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>앵커 형성 중.</div>}
                    </div>
                    <div className="sigcard"><h5><i className="ti ti-affiliate" /> 내 공통 계보 후보</h5>
                      {lineages.length ? lineages.slice(0, 5).map((l) => (
                        <div className="sigrow" key={l.label}><span className="nm" title={l.label}>{l.label}</span><span className="ct">{l.films}편</span></div>
                      )) : <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic" }}>계보 형성 중.</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 가면무도회 규칙 */}
            <div className="veil" title="가면무도회 · 부분 노출 규칙">
              <span className="vc show"><i className="ti ti-eye" /> 싱크율</span>
              <span className="vc show"><i className="ti ti-eye" /> 교집합 앵커</span>
              <span className="vc show"><i className="ti ti-eye" /> 공통 계보</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> 실명·사진</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> 개별 평점</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> 전체 취향</span>
            </div>

            <div className="rotate">
              <i className="ti ti-clock-hour-12" style={{ color: "var(--gold)", fontSize: 16 }} />
              <span className="cl">{hasPartner ? "이 동행이 머무는 시간" : "다음 동행이 올 수 있는 시간"}</span>
              <span className="cd">{cd.txt}</span>
              <span className="cl">자정(KST)이면 새 한 명으로 회전</span>
            </div>

            <div className="duo-actions">
              {revealBtn()}
              <span className="dbtn sec" onClick={showSignature} title="내가 무엇으로 매칭되는지 보기"><i className="ti ti-fingerprint" style={{ fontSize: 14 }} /> 내 매칭 재료</span>
              <span className="dbtn sec" onClick={() => setStatus(hasPartner ? "이 동행은 자정(KST)까지 — 벗지 않고 흘려보내도 됩니다." : "자정(KST)이면 새로 시도합니다 — 다른 관객이 취향을 확정하면 한 사람이 스쳐갑니다.")} title="자정이면 회전"><i className="ti ti-wind" style={{ fontSize: 14 }} /> 흘려보내기</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 10, color: "var(--sub)", marginTop: 7 }}><i className="ti ti-lock" style={{ fontSize: 10, verticalAlign: -1 }} /> 「가면 벗기」는 상호 동의 + 공개 프로필로만 — 공개 투영 이상은 결코 보이지 않습니다</div>
            <div className="duo-status">{status}</div>
          </div>
        </div>
      </div>

      {/* 지난 동행 history strip — me_pair_history 실기록 (부분노출 보존) */}
      <div className="pair-mod">
        <div className="pair-modh"><h3><i className="ti ti-calendar-stats" /> 지난 동행 · 하루 단위 회전</h3>
          <span className="meta">자정마다 1명 · 부분 노출 보존</span></div>
        <div className="pair-modbody">
          <div className="hstrip">
            {[0, 1, 2, 3, 4].map((i) => {
              const dayKey = kstDateOf(i);
              const h = histByDay.get(dayKey);
              const label = i === 0 ? "오늘 ●" : i === 1 ? "어제" : "";
              const s = h ? num(h.sync_pct) : null;
              return (
                <div className={`hcell${h ? "" : " empty"}`} key={dayKey}>
                  <div className="hd">{dayKey.slice(5).replace("-", ".")}{label ? ` · ${label}` : ""}</div>
                  {h ? (
                    <>
                      <div className="hp" style={{ color: "var(--masque)" }}>싱크 {s != null ? `${s}%` : "형성 중"}</div>
                      <div className="hn" title={h.top_anchor ?? ""}>{h.top_anchor ?? "교집합 없음"}</div>
                    </>
                  ) : (
                    <>
                      <div className="hp none">동행 없음</div>
                      <div className="hn">기록 없음</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <i className="ti ti-info-circle" style={{ verticalAlign: -1 }} /> 하루 한 명만 회전합니다. 지난 동행은 <b style={{ color: "var(--mut)" }}>싱크율과 최상위 교집합 앵커만</b> 남고, 실명·개별 취향은 끝내 가려집니다. 한쪽 벡터 표본이 부족하면 하드 숫자 대신 「형성 중」으로 표기.
          </div>
        </div>
      </div>
    </div>
  );
}
