/**
 * gen-spec — the writing contract, shared by every backend.
 * 정본: HANDOFF-앱패리티-공장.md · 런북: docs/RUNBOOK-app-parity.md
 *
 * The subscription runner (gen-run.mjs) and the credit-mode batch runner
 * (gen-batch.mjs) must judge prose by exactly the same rules, or a corpus written
 * half on each develops a seam no audit would attribute correctly. So the lint and
 * the request shape live here, in a module with no side effects, and both backends
 * import them rather than keeping their own copy.
 *
 * Pure: no I/O, no network, no process state. Safe to import from anywhere.
 */

export const PROMO = /\b(masterpiece|must[- ]see|tour de force|unforgettable|timeless|gripping|stunning|breathtaking|hidden gem|underrated|essential viewing|a wild ride|ahead of its time|magnum opus|iconic)\b/i;

/** The two thousand Invitations we already hold share a template. Repeated five
 *  thousand more times it stops being prose and becomes a stamp, so the moves that
 *  make up that template are refused at the door. */
export const FORMULA = [
  [/\bconverg(e|es|ing|ed)\b/i, "'converge' (템플릿 상투)"],
  [/\bHwadu\b/i, "'Hwadu' (템플릿 상투)"],
  [/\bcrucible\b/i, "'crucible'"],
  [/\bmeditation on\b/i, "'meditation on'"],
  [/at its (center|centre) is not a person but/i, "'at its center is not a person but'"],
  [/advances the [^.]{0,40}lineage/i, "'advances the … lineage'"],
  [/\ba landmark of\b/i, "'a landmark of'"],
  [/cast in the (mold|mould) of/i, "'cast in the mold of'"],
  [/^[A-Z][^,]{2,40} \(b\. \d{4}\)/, "'Director (b. YEAR)' 정형 도입"],
  // Measured at 1,291 items: the charter's own §5 wording came back 38 times as
  // "what stands to be lost is". The instructions are the only text every writer in
  // the corpus shares, so a phrase borrowed from them becomes the house tic at once.
  [/stands? to be lost/i, "헌장 문구 차용 'stands to be lost'"],
  [/\b(what|which) is at stake is\b/i, "'what is at stake is'"],
];

export const NEGATIVE = /\b(no (awards|record|reception|information|documentation)|little is known|not much is known|remains obscure|may not be for everyone)\b/i;

/** "Sembène" folded to ASCII is "Sembene" — used to tell a dropped accent apart from
 *  a name the writer simply never mentioned. */
export const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const SPECS = {
  leads: {
    prompt: "lead-en.md",
    outField: "lead",
    tools: "",
    ask: (payload) =>
      `Write the Invitation for each film below, following the charter. Output exactly one JSON object: {"items":[{"k":"…","lead":"…"}]}.\n\n` +
      `Each item's "facts" block is the whole of your evidence. Do not add facts to it.\n\n` +
      JSON.stringify(payload, null, 1),
    lint(item, text) {
      const errs = [];
      if (text == null) return ["누락"];
      const s = String(text).trim();
      if (!s) return [];                       // an honest refusal; counted separately
      if (/[\r\n]/.test(s)) errs.push("줄바꿈 포함");
      if (/```|^\s*[#*\-]\s/.test(s)) errs.push("마크다운 잔류");
      if (s.length < 450) errs.push(`짧음 ${s.length}자`);
      if (s.length > 1150) errs.push(`김 ${s.length}자`);
      const first = (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0].trim();
      if (first.length < 40) errs.push(`첫 문장 짧음 ${first.length}자`);
      if (first.length > 260) errs.push(`첫 문장 김 ${first.length}자 (카드 리드로 못 씀)`);
      const promo = s.match(PROMO);
      if (promo) errs.push(`홍보어 '${promo[0]}'`);
      for (const [re, msg] of FORMULA) if (re.test(s)) errs.push(msg);
      const neg = s.match(NEGATIVE);
      if (neg) errs.push(`부재 서술 '${neg[0]}'`);
      if (/\byou\b|\byour\b/i.test(s)) errs.push("2인칭");
      // Fact guard: every year the writer names must appear in the evidence block.
      // This is the cheapest hallucination check we have and it catches the
      // expensive kind — invented premieres, invented prizes, invented careers.
      const blob = JSON.stringify(item.facts);
      for (const y of new Set(s.match(/\b(1[89]\d{2}|20[0-3]\d)\b/g) || []))
        if (!blob.includes(y)) errs.push(`근거 없는 연도 ${y}`);
      // A trophy shelf reads the same on every film that has one. The charter asks for
      // one honour, but "two, well used" is prose we have already judged good — an
      // early sample paired a canon list with a festival in one clause and read well.
      // Rejecting at two clipped 32% of a proof batch, so the lint keeps only the
      // unarguable case and leaves the rest to the charter: guidance shapes, lint
      // rejects. (Same calibration lesson as the sentence-variety threshold.)
      const record = [...(item.facts?.honors ?? []), ...(item.facts?.canon_lists ?? [])];
      const named = record.filter((h) => h && s.toLowerCase().includes(String(h).toLowerCase()));
      if (named.length > 2) errs.push(`수상·목록 ${named.length}개 나열`);
      // Diacritics survive the trip or the name is simply wrong. Measured on the
      // first smoke batch: Sembène came back as Sembene, Hänsel as Hansel.
      for (const name of [item.facts?.director, item.facts?.title].filter(Boolean)) {
        if (name === fold(name)) continue;          // nothing to lose
        if (s.includes(name)) continue;
        if (s.includes(fold(name))) errs.push(`발음 부호 탈락: ${fold(name)} → ${name}`);
      }
      return errs;
    },
    row: (item, text, model) => ({
      entity_type: item.entity_type, entity_key: item.entity_key, field: item.field,
      film_id: item.film_id ?? null, lang: "en", text: String(text).trim(),
      model, source_sha256: item.sha256,
    }),
  },
};

/** Openings are checked across a batch, not within an item: any single opening can
 *  be fine and the column still read as one voice repeating. */
export function openingClashes(texts) {
  const heads = texts.map((t) => String(t).split(/\s+/).slice(0, 3).join(" ").toLowerCase());
  const dup = heads.filter((h, i) => heads.indexOf(h) !== i);
  return [...new Set(dup)];
}

export const stripFence = (s) =>
  String(s).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

export function parseItems(text) {
  const t = stripFence(text);
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("no JSON object in reply");
  const obj = JSON.parse(t.slice(a, b + 1));
  if (!Array.isArray(obj.items)) throw new Error("no items[]");
  return obj.items;
}
