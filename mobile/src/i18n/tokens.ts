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

// Storefront country names. A static map rather than Intl.DisplayNames, which
// needs a full-ICU Hermes build — a name that silently falls back to a code is a
// worse failure than 51 strings maintained by hand. Keyed by EDITIONS code.
const COUNTRIES: Partial<Record<UILocale, Map>> = {
  ko: {
    US: "미국", GB: "영국", CA: "캐나다", AU: "호주", IE: "아일랜드", NZ: "뉴질랜드",
    KR: "대한민국", JP: "일본", FR: "프랑스", DE: "독일", ES: "스페인", IT: "이탈리아",
    NL: "네덜란드", SE: "스웨덴", IN: "인도", MX: "멕시코", BR: "브라질",
  },
  es: {
    US: "Estados Unidos", GB: "Reino Unido", CA: "Canadá", AU: "Australia", IE: "Irlanda",
    NZ: "Nueva Zelanda", KR: "Corea del Sur", JP: "Japón", FR: "Francia", DE: "Alemania",
    ES: "España", IT: "Italia", NL: "Países Bajos", SE: "Suecia", IN: "India",
    MX: "México", BR: "Brasil",
  },
  ja: {
    US: "アメリカ", GB: "イギリス", CA: "カナダ", AU: "オーストラリア", IE: "アイルランド",
    NZ: "ニュージーランド", KR: "韓国", JP: "日本", FR: "フランス", DE: "ドイツ",
    ES: "スペイン", IT: "イタリア", NL: "オランダ", SE: "スウェーデン", IN: "インド",
    MX: "メキシコ", BR: "ブラジル",
  },
};

export function countryLabel(code: string, en: string): string {
  return COUNTRIES[getLocale()]?.[code] ?? en;
}

// The 13 expectation dimensions (lib/cinecodex_dims.ts on the web is the single
// vocabulary; these are its labels projected). Keyed on the registry KEY, never
// on the English label — the label is display text and may be reworded.
const DIMS: Partial<Record<UILocale, Map>> = {
  ko: {
    cog: "지성", aff: "정서", form: "형식", moral: "윤리", dur: "지속성",
    itx: "상호텍스트", fr: "형식적 급진성", etx: "맥락 의존", ctx: "작가 계보",
    bank: "공허", insincere: "불성실", coward: "회피", polar: "논쟁성",
  },
  es: {
    cog: "Cognitivo", aff: "Afectivo", form: "Formal", moral: "Moral", dur: "Durabilidad",
    itx: "Intertextual", fr: "Radicalidad formal", etx: "Extratextual", ctx: "Obra de autor",
    bank: "Vacuidad", insincere: "Insinceridad", coward: "Cobardía", polar: "Polarización",
  },
  ja: {
    cog: "知的", aff: "情動", form: "形式", moral: "倫理", dur: "持続性",
    itx: "間テクスト性", fr: "形式的急進性", etx: "テクスト外", ctx: "作家の系譜",
    bank: "空虚", insincere: "不誠実", coward: "回避", polar: "論争性",
  },
};

export function dimLabel(key: string, en: string): string {
  return DIMS[getLocale()]?.[key] ?? en;
}

// A lineage row's outcome. The BFF ships the raw ledger value ("won",
// "nominated") — a data token, not prose, so it is projected here.
const RESULTS: Partial<Record<UILocale, Map>> = {
  ko: { won: "수상", nominated: "후보", winner: "수상", nominee: "후보", listed: "선정" },
  es: { won: "ganó", nominated: "nominada", winner: "ganó", nominee: "nominada", listed: "incluida" },
  ja: { won: "受賞", nominated: "ノミネート", winner: "受賞", nominee: "ノミネート", listed: "選出" },
};

export function resultLabel(en: string): string {
  return RESULTS[getLocale()]?.[en.toLowerCase()] ?? en;
}

// Filming-location countries. The pin ships a country NAME, not a code, so this
// is keyed on the English name (the same reason COUNTRIES above is keyed on a
// code — different upstream, different key). Sixty entries cover >99% of pins;
// anything rarer keeps its English name, which is correct on a map.
//
// Static rather than Intl.DisplayNames for the reason given above: Hermes is not
// a full-ICU build, and a name that silently degrades to "US" is worse than one
// maintained by hand. Duplicates ("Turkey"/"Türkiye", "Czechia"/"Czech Republic")
// are intentional — the upstream data carries both spellings.
const COUNTRY_NAMES: Partial<Record<UILocale, Map>> = {
  ko: {
    "United States": "미국", "United Kingdom": "영국", France: "프랑스", Italy: "이탈리아",
    Japan: "일본", Spain: "스페인", Germany: "독일", Canada: "캐나다",
    "South Korea": "대한민국", India: "인도", China: "중국", Mexico: "멕시코",
    Australia: "호주", Poland: "폴란드", Sweden: "스웨덴", Brazil: "브라질",
    Ireland: "아일랜드", Russia: "러시아", Taiwan: "대만", Argentina: "아르헨티나",
    "Hong Kong": "홍콩", "New Zealand": "뉴질랜드", Czechia: "체코", "Czech Republic": "체코",
    Denmark: "덴마크", Belgium: "벨기에", Iran: "이란", Greece: "그리스",
    Morocco: "모로코", "Türkiye": "튀르키예", Turkey: "튀르키예", Austria: "오스트리아",
    Norway: "노르웨이", Hungary: "헝가리", Netherlands: "네덜란드", Switzerland: "스위스",
    Romania: "루마니아", Portugal: "포르투갈", Chile: "칠레", Ukraine: "우크라이나",
    Thailand: "태국", Israel: "이스라엘", Iceland: "아이슬란드", Colombia: "콜롬비아",
    Philippines: "필리핀", Finland: "핀란드", Tunisia: "튀니지", Croatia: "크로아티아",
    Indonesia: "인도네시아", "South Africa": "남아프리카공화국", Vietnam: "베트남",
    Egypt: "이집트", Senegal: "세네갈", Kenya: "케냐", Jordan: "요르단",
    Algeria: "알제리", Malta: "몰타", Peru: "페루", Serbia: "세르비아",
    Guatemala: "과테말라",
  },
  ja: {
    "United States": "アメリカ", "United Kingdom": "イギリス", France: "フランス", Italy: "イタリア",
    Japan: "日本", Spain: "スペイン", Germany: "ドイツ", Canada: "カナダ",
    "South Korea": "韓国", India: "インド", China: "中国", Mexico: "メキシコ",
    Australia: "オーストラリア", Poland: "ポーランド", Sweden: "スウェーデン", Brazil: "ブラジル",
    Ireland: "アイルランド", Russia: "ロシア", Taiwan: "台湾", Argentina: "アルゼンチン",
    "Hong Kong": "香港", "New Zealand": "ニュージーランド", Czechia: "チェコ", "Czech Republic": "チェコ",
    Denmark: "デンマーク", Belgium: "ベルギー", Iran: "イラン", Greece: "ギリシャ",
    Morocco: "モロッコ", "Türkiye": "トルコ", Turkey: "トルコ", Austria: "オーストリア",
    Norway: "ノルウェー", Hungary: "ハンガリー", Netherlands: "オランダ", Switzerland: "スイス",
    Romania: "ルーマニア", Portugal: "ポルトガル", Chile: "チリ", Ukraine: "ウクライナ",
    Thailand: "タイ", Israel: "イスラエル", Iceland: "アイスランド", Colombia: "コロンビア",
    Philippines: "フィリピン", Finland: "フィンランド", Tunisia: "チュニジア", Croatia: "クロアチア",
    Indonesia: "インドネシア", "South Africa": "南アフリカ", Vietnam: "ベトナム",
    Egypt: "エジプト", Senegal: "セネガル", Kenya: "ケニア", Jordan: "ヨルダン",
    Algeria: "アルジェリア", Malta: "マルタ", Peru: "ペルー", Serbia: "セルビア",
    Guatemala: "グアテマラ",
  },
  es: {
    "United States": "Estados Unidos", "United Kingdom": "Reino Unido", France: "Francia",
    Italy: "Italia", Japan: "Japón", Spain: "España", Germany: "Alemania", Canada: "Canadá",
    "South Korea": "Corea del Sur", India: "India", China: "China", Mexico: "México",
    Australia: "Australia", Poland: "Polonia", Sweden: "Suecia", Brazil: "Brasil",
    Ireland: "Irlanda", Russia: "Rusia", Taiwan: "Taiwán", Argentina: "Argentina",
    "Hong Kong": "Hong Kong", "New Zealand": "Nueva Zelanda", Czechia: "Chequia",
    "Czech Republic": "Chequia", Denmark: "Dinamarca", Belgium: "Bélgica", Iran: "Irán",
    Greece: "Grecia", Morocco: "Marruecos", "Türkiye": "Turquía", Turkey: "Turquía",
    Austria: "Austria", Norway: "Noruega", Hungary: "Hungría", Netherlands: "Países Bajos",
    Switzerland: "Suiza", Romania: "Rumanía", Portugal: "Portugal", Chile: "Chile",
    Ukraine: "Ucrania", Thailand: "Tailandia", Israel: "Israel", Iceland: "Islandia",
    Colombia: "Colombia", Philippines: "Filipinas", Finland: "Finlandia", Tunisia: "Túnez",
    Croatia: "Croacia", Indonesia: "Indonesia", "South Africa": "Sudáfrica", Vietnam: "Vietnam",
    Egypt: "Egipto", Senegal: "Senegal", Kenya: "Kenia", Jordan: "Jordania",
    Algeria: "Argelia", Malta: "Malta", Peru: "Perú", Serbia: "Serbia",
    Guatemala: "Guatemala",
  },
};

export function countryNameLabel(en: string): string {
  return COUNTRY_NAMES[getLocale()]?.[en] ?? en;
}

// The TV programme's dek. 1,808 programmes carry exactly ONE shape —
// "N chapters · the misreading, the critics, the places, the canon" — assembled
// by the factory, so it is a template rather than prose and belongs here.
//
// Matched, not assumed: anything the factory ships in a different shape passes
// through in English rather than being silently rewritten into a lie.
const TV_DEK_TAIL = "the misreading, the critics, the places, the canon";
const TV_DEK: Partial<Record<UILocale, string>> = {
  ko: "{n}개 장 · 오독, 비평, 장소, 정전",
  es: "{n} capítulos · la mala lectura, la crítica, los lugares, el canon",
  ja: "{n}章 · 誤読、批評、場所、正典",
};

export function tvDekLabel(dek: string): string {
  const tpl = TV_DEK[getLocale()];
  if (!tpl) return dek;
  const m = dek.match(/^(\d+) chapters · (.+)$/);
  if (!m || m[2] !== TV_DEK_TAIL) return dek;
  return tpl.replace("{n}", m[1]);
}
