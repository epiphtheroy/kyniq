// Localization for DATA TOKENS that get rendered as UI.
//
// GENRES, decade labels and TakeScore band words live in data modules
// (lib/browse.ts, lib/takescore.ts) because their English strings are also query
// values sent to the BFF. They must stay English on the wire — so the values are
// never translated in place; they are projected here, at render time only.
//
// Genre names are TMDB's own official naming (GET /genre/movie/list?language=ko),
// mirrored from the web's lib/i18n/genres.ts — not our translation.
import { getLocale } from "./index";
import type { UILocale } from "../editions";
import type { Axis } from "../lib/takescore";

type Map = Record<string, string>;

const GENRES: Partial<Record<UILocale, Map>> = {
  ko: {
    Action: "액션", Adventure: "모험", Animation: "애니메이션", Comedy: "코미디",
    Crime: "범죄", Documentary: "다큐멘터리", Drama: "드라마", Family: "가족",
    Fantasy: "판타지", History: "역사", Horror: "공포", Music: "음악",
    Mystery: "미스터리", Romance: "로맨스", "Science Fiction": "SF",
    "TV Movie": "TV 영화", Thriller: "스릴러", War: "전쟁", Western: "서부",
  },
  es: {
    Action: "Acción", Adventure: "Aventura", Animation: "Animación", Comedy: "Comedia",
    Crime: "Crimen", Documentary: "Documental", Drama: "Drama", Family: "Familia",
    Fantasy: "Fantasía", History: "Historia", Horror: "Terror", Music: "Música",
    Mystery: "Misterio", Romance: "Romance", "Science Fiction": "Ciencia ficción",
    "TV Movie": "Película de TV", Thriller: "Suspense", War: "Bélica", Western: "Western",
  },
  ja: {
    Action: "アクション", Adventure: "アドベンチャー", Animation: "アニメーション",
    Comedy: "コメディ", Crime: "犯罪", Documentary: "ドキュメンタリー", Drama: "ドラマ",
    Family: "ファミリー", Fantasy: "ファンタジー", History: "履歴", Horror: "ホラー",
    Music: "音楽", Mystery: "ミステリー", Romance: "ロマンス",
    "Science Fiction": "サイエンスフィクション", "TV Movie": "テレビ映画",
    Thriller: "スリラー", War: "戦争", Western: "西部劇",
  },
};

/** A TMDB genre in the current UI language; unknown genres pass through. */
export function genreLabel(en: string): string {
  return GENRES[getLocale()]?.[en] ?? en;
}

/** "1980s" → "1980년대". The English label is also the sort key, so project only. */
export function decadeLabel(en: string): string {
  const loc = getLocale();
  const decade = /^(\d{4})s$/.exec(en)?.[1];
  if (!decade) return en;
  if (loc === "ko") return `${decade}년대`;
  if (loc === "ja") return `${decade}年代`;
  if (loc === "es") return `Años ${decade.slice(2)}`;
  return en;
}

// TakeScore band words. Five steps per axis, same order as BAND_WORDS.
const BANDS: Partial<Record<UILocale, Record<Axis, string[]>>> = {
  ko: {
    value: ["희미한 흔적", "적당한 소득", "탄탄하지만 정점은 아님", "강하고 오래 남는", "예외적 — 정전급"],
    cost: ["그냥 들어가면 된다", "약간의 예습", "제대로 된 준비", "숙련자용", "전문가의 영역"],
    risk: ["거의 무위험", "낮은 손실", "약간의 위험", "실망할 확률 높음", "심각 — 도박"],
  },
  es: {
    value: ["Rastros tenues", "Retorno justo", "Sólida, no cumbre", "Fuerte y duradera", "Excepcional — de canon"],
    cost: ["Entra sin más", "Algo de contexto", "Preparación real", "Visionado avanzado", "Terreno experto"],
    risk: ["Casi sin riesgo", "Poco que perder", "Algún riesgo", "Alto riesgo de decepción", "Grave — una apuesta"],
  },
  ja: {
    value: ["かすかな痕跡", "まずまずの収穫", "堅実だが頂点ではない", "強く、長く残る", "例外的 — 正典級"],
    cost: ["そのまま入れる", "少しの予習", "本格的な準備", "上級者向け", "専門家の領域"],
    risk: ["ほぼ無リスク", "損は小さい", "多少の危険", "失望の可能性大", "重大 — 賭け"],
  },
};

/** Band word for an axis/step in the current UI language. `en` is the fallback. */
export function bandWordLabel(axis: Axis, step: number, en: string): string {
  return BANDS[getLocale()]?.[axis]?.[step - 1] ?? en;
}

// The four quadrant verdicts, keyed by (high value, low risk).
const VERDICTS: Partial<Record<UILocale, [string, string, string, string]>> = {
  ko: [
    "높은 값어치 · 낮은 위험 — 안전한 걸작.",
    "높은 값어치 · 높은 위험 — 야심적이지만 호불호가 갈린다.",
    "탄탄하지만 정점은 아니다 — 무난한 선택.",
    "값어치도 위험도 중간 — 조심스럽게 접근할 것.",
  ],
  es: [
    "Alto valor · bajo riesgo: una obra maestra segura.",
    "Alto valor · alto riesgo: ambiciosa pero divisiva.",
    "Sólida sin ser cumbre: una elección estable.",
    "Valor medio, riesgo medio: acércate con cuidado.",
  ],
  ja: [
    "高い価値・低いリスク — 安全な傑作。",
    "高い価値・高いリスク — 野心的だが評価が割れる。",
    "堅実だが頂点ではない — 安定した選択。",
    "価値もリスクも中程度 — 慎重に。",
  ],
};

export function verdictLabel(idx: 0 | 1 | 2 | 3, en: string): string {
  return VERDICTS[getLocale()]?.[idx] ?? en;
}

// to.W verdict badges — a closed set of five from curation.v_film_comment. Enum
// words, so they live here rather than in content_i18n; unknown values pass
// through, which is what happens if curation ever adds a sixth.
const TOW_VERDICTS: Partial<Record<UILocale, Map>> = {
  ko: {
    Optional: "선택 관람",
    "Deep cut": "숨은 카드",
    "Popular, not canon": "유명하지만 정전은 아님",
    Essential: "반드시 볼 것",
    "Start here": "여기서 시작",
  },
  es: {
    Optional: "Opcional",
    "Deep cut": "Joya escondida",
    "Popular, not canon": "Popular, no de canon",
    Essential: "Imprescindible",
    "Start here": "Empieza aquí",
  },
  ja: {
    Optional: "任意",
    "Deep cut": "隠れた一本",
    "Popular, not canon": "有名だが正典ではない",
    Essential: "必見",
    "Start here": "ここから",
  },
};

export function towVerdictLabel(en: string): string {
  return TOW_VERDICTS[getLocale()]?.[en] ?? en;
}
