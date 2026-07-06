// figure 제목의 검색어 정렬 레이어 — 규칙 계층 (렌더 타임, DB 불요).
// 깨끗한 라벨(짧고, 영화 제목 미포함, 절 구조 없음)만 질문형으로 변환하고,
// 그 외에는 null을 돌려 기존 렌더를 유지한다. DB에 LLM 생성 seo_question이
// 생기면 그것이 우선하고 이 함수는 폴백이 된다. (파일럿 실측: 깨끗한 라벨은
// LLM 출력과 템플릿 출력이 동일 — outputs/figure_seo/RUNBOOK.md)
const CLAUSE_RE = /,| — | as | who | which | that | when | where /i;
const MAX_Q_LEN = 95;

export function ruleFigureQuestion(label: string, kind: string | null, filmTitle: string): string | null {
  const lab = label.trim();
  if (!lab || lab.length > 50 || lab.endsWith(".")) return null;
  if (lab.toLowerCase().includes(filmTitle.toLowerCase())) return null;
  if (CLAUSE_RE.test(lab)) return null;
  let q: string;
  if (/^the film as a whole$/i.test(lab)) {
    q = `What is ${filmTitle} really about?`;
  } else if (kind && /char/i.test(kind)) {
    // "The character of Monsieur Merde" → "Who is Monsieur Merde in …?"
    const name = lab.replace(/^the character of\s+/i, "");
    q = `Who is ${name} in ${filmTitle}?`;
  } else {
    let core = lab;
    if (/^The\s/.test(core)) core = `the ${core.slice(4)}`;
    else if (/^[a-z]/.test(core)) core = `the ${core}`;
    q = `What does ${core} mean in ${filmTitle}?`;
  }
  return q.length <= MAX_Q_LEN ? q : null;
}
