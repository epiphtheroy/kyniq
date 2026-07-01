"use client";
/** /room/pair — 동행 (slow pair · 가면무도회 · 하루 한 명 · 자정 KST 회전).
 *  싱크율 = 두 사람 v_loved 코사인 (engine ①). REAL: me_pair_state(상대 존재 여부) +
 *  me_taste_signature(내 loved 취향 앵커·계보). 두 번째 유저가 없으면(candidates=0)
 *  가짜 파트너를 만들지 않고 정직한 「아직 동행 상대 없음 · 초대」 상태로, 대신 내 취향
 *  시그니처(무엇이 매칭될지)를 실측으로 보여준다. Inspector-swap mirrors CollectionWorkspace. */
import { useMemo, useState, useEffect, useCallback } from "react";
import { useInspector } from "./InspectorContext";

export type PairState = { candidates: number; loved_n: number; forming: boolean };
export type SigRow = { kind: string; label: string; films: number };

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

export default function PairWorkspace({ state, sig }: { state: PairState; sig: SigRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const [cd, setCd] = useState(kstCountdown());
  const [status, setStatus] = useState("");

  useEffect(() => { const t = setInterval(() => setCd(kstCountdown()), 1000); return () => clearInterval(t); }, []);

  const anchors = useMemo(() => sig.filter((s) => s.kind === "anchor"), [sig]);
  const lineages = useMemo(() => sig.filter((s) => s.kind === "lineage"), [sig]);
  const hasPartner = state.candidates > 0;      // a real second user exists to sync with
  const forming = state.forming;                // my own taste < 8 loved → 형성 중

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
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>「가면 벗기」는 그의 <b style={{ color: "var(--mut)" }}>공개 프로필</b>로만 연결됩니다 — 공개 투영 이상은 결코 드러나지 않습니다.</div>
        </div>
        <div className="icard"><h4><i className="ti ti-fingerprint" /> 내 싱크 재료 · v_loved</h4>
          {forming ? (
            <div style={{ fontSize: 11.5, color: "var(--forming-tx)", fontStyle: "italic" }}>취향 벡터 형성 중 (loved {state.loved_n}/8) — 8편부터 싱크율이 산출됩니다.</div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--safe)" }}>취향 벡터 확정 · loved {state.loved_n}편 — 상대만 나타나면 싱크 산출 가능.</div>
          )}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>싱크 = 두 사람 v_loved 코사인. 한쪽이 <b style={{ color: "var(--forming-tx)" }}>taste_forming(loved&lt;8)</b>이면 하드 숫자 대신 「형성 중」.</div>
        </div>
      </div>
    );
  }, [setDefault, forming, state.loved_n]);

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
                strokeDasharray="239" strokeDashoffset={forming ? 239 : 90} transform="rotate(-90 46 46)" />
              <text x="46" y="44" textAnchor="middle" fontSize={hasPartner ? "21" : "13"} fill="#ECEAE5" fontFamily="ui-monospace,monospace" fontWeight="600">{hasPartner ? "—" : "대기"}</text>
              <text x="46" y="58" textAnchor="middle" fontSize="8" fill="#6C6960" letterSpacing="1.5">{hasPartner ? "싱크" : "상대"}</text>
            </svg>
          </div>
          <div className="pair-navmeta">
            <div className="eb">오늘의 동행 · 가면무도회</div>
            <div className="lvl" style={{ color: "var(--violet)" }}>● {hasPartner ? "매칭 대기 · 부분 노출" : "아직 동행 상대 없음"}</div>
            <div className="pctl">{forming ? `취향 형성 중 · loved ${state.loved_n}/8 — 8편부터 싱크 가능` : `취향 벡터 확정 · loved ${state.loved_n}편 준비됨`}</div>
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
        <div className="pair-explain"><i className="ti ti-info-circle" /> 싱크율 = 두 사람 <b style={{ color: "var(--mut)" }}>v_loved 코사인</b> — 가면무도회는 <b style={{ color: "var(--mut)" }}>교집합 앵커·공통 계보만</b> 보여줍니다. 실명·개별 평점·전체 취향은 끝까지 가립니다. 자정(KST)에 새 한 명으로 회전.</div>
      </div>

      {/* KPI STRIP */}
      <div className="pair-kpis">
        <div className="pair-kpi"><div className="eb">동행 상대</div><div className="v">{state.candidates}</div><div className="d flat">{hasPartner ? "매칭 가능" : "대기 · 초대"}</div></div>
        <div className="pair-kpi"><div className="eb">내 취향 앵커</div><div className="v">{anchors.length}</div><div className="d up">실측 · 매칭 재료</div></div>
        <div className="pair-kpi"><div className="eb">공통 계보 후보</div><div className="v">{lineages.length}</div><div className="d flat">loved 기반</div></div>
        <div className="pair-kpi"><div className="eb">자정 회전</div><div className="v mono" style={{ fontSize: 18 }}>{cd.txt}</div><div className="d flat">KST · 새 한 명</div></div>
        <div className="pair-kpi"><div className="eb">취향 벡터</div><div className="v" style={{ fontSize: 17, color: forming ? "var(--forming)" : "var(--safe)" }}>{forming ? "형성중" : "확정"}</div><div className="d flat">loved {state.loved_n}편</div></div>
      </div>

      {/* CENTERPIECE · 오늘의 동행 가면무도회 */}
      <div className="pair-mod">
        <div className="pair-modh"><h3><i className="ti ti-masks-theater" /> 오늘의 동행 · 가면무도회</h3>
          <span className="meta">하루 한 명 · 부분 노출 · 자정(KST) 회전</span></div>
        <div className="pair-modbody" style={{ padding: 0 }}>
          <div className="duo">
            <div className="duo-lead"><i className="ti ti-masks-theater" style={{ color: "var(--violet)", fontSize: 17 }} />
              <span className="ttl">{hasPartner ? "오늘 통하는 한 사람" : "아직, 함께 통과할 한 사람이 없습니다"}</span>
              <span className="sub"><i className="ti ti-info-circle" />DM 아님 · 공개 아님</span></div>

            <div className="pair">
              <div className="mask">
                <svg width="76" height="76" viewBox="0 0 76 76"><ellipse cx="38" cy="38" rx="30" ry="34" fill="var(--masque-iris)" stroke="var(--masque)" strokeWidth="1.3" />
                  <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
                  <path d="M24 50 Q38 56 52 50" fill="none" stroke="var(--masque)" strokeWidth="1.2" /></svg>
                <div className="nm">당신</div><div className="rl">{anchors[0]?.label ? "절제된 응시 · 깊은 항해자" : "형성 중"}</div>
              </div>
              <div className="sync">
                <div className={`pv${hasPartner ? "" : " empty"}`}>{hasPartner ? "—" : "?"}</div>
                <div className="pl">싱크율</div>
                <div className="fm">v_loved 코사인</div>
              </div>
              <div className="mask">
                <svg width="76" height="76" viewBox="0 0 76 76"><ellipse cx="38" cy="38" rx="30" ry="34" fill="#1c1c20" stroke="var(--sub)" strokeWidth="1.3" strokeDasharray="4 3" />
                  <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
                  <path d="M24 51 Q38 51 52 51" fill="none" stroke="var(--sub)" strokeWidth="1.2" /></svg>
                <div className="nm">상대 <span style={{ color: "var(--sub)", fontSize: 11 }}>· 빈 가면</span></div>
                <div className="rl">{hasPartner ? "부분 노출 대기" : "아직 아무도 없음"}</div>
              </div>
            </div>

            {/* invite / empty state — honest, no fabricated partner */}
            <div className="ident">
              <div className="lbl">두 분의 교집합 · 앵커</div>
              <div className="invite">
                <div className="big">{hasPartner ? "매칭을 기다리는 중" : "동행은 두 사람부터 시작됩니다"}</div>
                <div className="sub">
                  아직 <b>동행 상대</b>가 없어 싱크율을 계산할 수 없습니다. 다른 관객이 취향 벡터(★4.5+ 8편)를 확정하면, 자정(KST)마다 <b>가장 통하는 한 사람</b>이 가면을 쓴 채 나타납니다. 가짜 숫자는 만들지 않습니다.
                </div>
                <div className="seed"><i className="ti ti-seedling" /> {forming ? `내 취향 형성 중 · loved ${state.loved_n}/8` : `내 취향 준비됨 · loved ${state.loved_n}편`}</div>
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

              <div className="duo-foot">
                <span>내 레벨 <b>{forming ? "형성 중" : "Established"}</b></span>
                <span>매칭 재료 앵커 <b>{anchors.length}</b></span>
                <span>계보 후보 <b>{lineages.length}</b></span>
              </div>
            </div>

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
              <span className="cl">다음 동행이 올 수 있는 시간</span>
              <span className="cd">{cd.txt}</span>
              <span className="cl">자정(KST)이면 새 한 명으로 회전</span>
            </div>

            <div className="duo-actions">
              <span className="dbtn pri disabled" title="동행 상대가 나타나면 활성화됩니다"><i className="ti ti-mask-off" style={{ fontSize: 15 }} /> 가면 벗기 (상대 대기)</span>
              <span className="dbtn sec" onClick={showSignature} title="내가 무엇으로 매칭되는지 보기"><i className="ti ti-fingerprint" style={{ fontSize: 14 }} /> 내 매칭 재료</span>
              <span className="dbtn sec" onClick={() => setStatus("자정(KST)이면 새로 시도합니다 — 다른 관객이 취향을 확정하면 한 사람이 스쳐갑니다.")} title="자정이면 다시 시도"><i className="ti ti-wind" style={{ fontSize: 14 }} /> 흘려보내기</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 10, color: "var(--sub)", marginTop: 7 }}><i className="ti ti-lock" style={{ fontSize: 10, verticalAlign: -1 }} /> 「가면 벗기」는 공개 프로필로만 — 공개 투영 이상은 결코 보이지 않습니다</div>
            <div className="duo-status">{status}</div>
          </div>
        </div>
      </div>

      {/* 지난 동행 history strip — 정직한 빈/형성 상태 (실제 동행 기록 없음) */}
      <div className="pair-mod">
        <div className="pair-modh"><h3><i className="ti ti-calendar-stats" /> 지난 동행 · 하루 단위 회전</h3>
          <span className="meta">자정마다 1명 · 부분 노출 보존</span></div>
        <div className="pair-modbody">
          <div className="hstrip">
            {[0, 1, 2, 3, 4].map((i) => {
              const d = new Date(); d.setDate(d.getDate() - i);
              const label = i === 0 ? "오늘 ●" : i === 1 ? "어제" : "";
              return (
                <div className="hcell empty" key={i}>
                  <div className="hd">{pad(d.getMonth() + 1)}.{pad(d.getDate())}{label ? ` · ${label}` : ""}</div>
                  <div className="hp none">동행 없음</div>
                  <div className="hn">기록 대기</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 9 }}>
            <i className="ti ti-info-circle" style={{ verticalAlign: -1 }} /> 하루 한 명만 회전합니다 — 아직 동행 기록이 없습니다. 지난 동행은 <b style={{ color: "var(--mut)" }}>교집합 앵커만</b> 남고, 실명·개별 취향은 끝내 가려집니다. 한쪽이 <b style={{ color: "var(--forming)" }}>taste_forming(loved&lt;8)</b>이면 하드 숫자 대신 「형성 중」으로 표기.
          </div>
        </div>
      </div>
    </div>
  );
}
