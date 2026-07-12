// Keyword Radar — JS matcher (mirror of radar/matcher.py; 정본 HANDOFF §5).
// Aho-Corasick over space-padded normalized phrases so cost is independent of
// keyword count (the streamers match every firehose event against all keywords).

// MUST stay byte-equivalent to matcher.py: /[^\p{L}\p{N}]+/gu collapses every
// non-alphanumeric run (punctuation, whitespace, AND underscore) to one space,
// exactly like Python's [\W_]+, so the JS streamers and Python pollers match
// identically. The CONTEXT_WORDS alternation is also kept in sync with matcher.py.
const NON_ALNUM = /[^\p{L}\p{N}]+/gu;

export const CONTEXT_WORDS = new RegExp(
  "\\b(film|movie|movies|cinema|cinematic|director|directed|actor|actress|cast|" +
  "casting|screenplay|screening|trailer|box office|sequel|remake|reboot|oscar|" +
  "academy award|festival|cannes|venice|berlinale|sundance|premiere|review|" +
  "criterion|letterboxd|mubi|a24|neon|screen|studio|blu-ray|4k restoration|" +
  "filmmaker|filmmaking|auteur|cinephile|watched|rewatch)\\b" +
  "|영화|감독|배우|개봉|극장|시네마|재감상|감상평|후기|평론|스포일러",
  "i"
);

export function norm(s) {
  if (!s) return "";
  return s.toLowerCase().replace(NON_ALNUM, " ").trim();
}

export class Matcher {
  constructor(keywords) {
    this.kw = new Map();
    const patterns = new Map(); // patternString -> Set(kwId)
    for (const k of keywords) {
      this.kw.set(k.id, k);
      const forms = [k.norm || norm(k.match_text || k.keyword || "")];
      for (const a of k.aliases || []) forms.push(norm(a));
      for (const f of forms) {
        if (f.length < 2) continue;
        const pat = ` ${f} `;
        if (!patterns.has(pat)) patterns.set(pat, new Set());
        patterns.get(pat).add(k.id);
      }
    }
    this._build(patterns);
  }

  _build(patterns) {
    this.goto = [new Map()];
    this.out = [new Set()];
    for (const [pat, kids] of patterns) {
      let s = 0;
      for (const ch of pat) {
        let nxt = this.goto[s].get(ch);
        if (nxt === undefined) {
          nxt = this.goto.length;
          this.goto.push(new Map());
          this.out.push(new Set());
          this.goto[s].set(ch, nxt);
        }
        s = nxt;
      }
      for (const kid of kids) this.out[s].add(kid);
    }
    this.fail = new Array(this.goto.length).fill(0);
    const q = [];
    for (const [, s] of this.goto[0]) { this.fail[s] = 0; q.push(s); }
    let head = 0;
    while (head < q.length) {
      const r = q[head++];
      for (const [ch, s] of this.goto[r]) {
        q.push(s);
        let f = this.fail[r];
        while (f && !this.goto[f].has(ch)) f = this.fail[f];
        this.fail[s] = (f || this.goto[0].has(ch)) ? (this.goto[f].get(ch) ?? 0) : 0;
        for (const kid of this.out[this.fail[s]]) this.out[s].add(kid);
      }
    }
  }

  find(text) {
    const hits = new Set();
    if (!text) return hits;
    const padded = ` ${norm(text)} `;
    let s = 0;
    for (const ch of padded) {
      while (s && !this.goto[s].has(ch)) s = this.fail[s];
      s = this.goto[s].get(ch) ?? 0;
      if (this.out[s].size) for (const kid of this.out[s]) hits.add(kid);
    }
    return hits;
  }

  match(text, sourceBeat = null) {
    const raw = this.find(text);
    if (!raw.size) return new Set();
    const hasCtx = sourceBeat === "film" || CONTEXT_WORDS.test(text);
    const out = new Set();
    for (const kid of raw) {
      if (this.kw.get(kid)?.require_context && !hasCtx) continue;
      out.add(kid);
    }
    return out;
  }
}
