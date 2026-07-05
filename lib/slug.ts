/**
 * Shared slug + diacritic folding. Client-safe (pure, no env access).
 *
 * NFKD strips combining marks (e.g. e-acute, a-umlaut, n-tilde); TRANSLIT
 * covers letters with no Unicode decomposition (l-stroke, o-slash, eszett, ...)
 * that a bare NFKD pass would drop entirely — the bug that minted director
 * slugs like "aki-kaurism-ki" and "pawe-pawlikowski".
 * Every generator that mints a public slug must go through slugify() here.
 */
const TRANSLIT: Record<string, string> = {
  "ł": "l", // ł
  "ø": "o", // ø
  "đ": "d", // đ
  "ß": "ss", // ß
  "æ": "ae", // æ
  "œ": "oe", // œ
  "ð": "d", // ð
  "þ": "th", // þ
  "ı": "i", // ı (dotless i)
  "ħ": "h", // ħ
  "ŋ": "n", // ŋ
};

export function foldDiacritics(text: string): string {
  const stripped = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  let out = "";
  for (const ch of stripped) {
    out += ch.charCodeAt(0) > 127 ? TRANSLIT[ch.toLowerCase()] ?? ch : ch;
  }
  return out;
}

export function slugify(text: string): string {
  return foldDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
