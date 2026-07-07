/**
 * The Engine Room desks — registry, markdown rendering, entity linkification.
 *
 * Essays are stored as markdown (essays.body_md) and are immutable after
 * verification; all presentation transforms (HTML conversion, internal links)
 * happen here at render time. No external markdown dependency — the corpus is
 * generated against a fixed output contract, so the converter below covers the
 * full grammar that contract allows (headings, bold/italic, lists, quotes,
 * links, hr) and nothing more.
 */

export type DeskKey =
  | "theories"
  | "decoder"
  | "debates"
  | "contested"
  | "reception-story"
  | "parallel-lives"
  | "field-test"
  | "exegesis";

export type Desk = {
  key: DeskKey;
  mode: string; // essays.mode
  label: string; // short chip label
  deskName: string; // editorial desk name (Engine Room page)
  metaTitle: (title: string, year: number | null) => string;
  blurb: string; // one-liner for hubs/engine-room
};

const y = (year: number | null) => (year ? ` (${year})` : "");

export const DESKS: Record<DeskKey, Desk> = {
  theories: {
    key: "theories",
    mode: "fan_theories",
    label: "Fan Theories",
    deskName: "The Apocrypha Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} Fan Theories, Ranked and Fact-Checked`,
    blurb: "The theories fans actually argue about — sourced, weighed, and ruled on.",
  },
  decoder: {
    key: "decoder",
    mode: "concept_briefing",
    label: "Decoder",
    deskName: "The Decoder Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} Explained — the Concepts That Unlock It`,
    blurb: "The film's central puzzle, decoded with named concepts from real theory.",
  },
  debates: {
    key: "debates",
    mode: "meta_critique",
    label: "Debates",
    deskName: "The Debates Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} — the Critical Debates, Mapped`,
    blurb: "What critics actually disagreed about, and what the disagreement reveals.",
  },
  contested: {
    key: "contested",
    mode: "radical_critique",
    label: "Contested",
    deskName: "The Contested Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} — the Case Against and the Case For`,
    blurb: "The strongest radical critiques a film must survive — argued at full strength.",
  },
  "reception-story": {
    key: "reception-story",
    mode: "reception_meta",
    label: "Reception Story",
    deskName: "The Reception Desk",
    metaTitle: (t, yr) => `How ${t}${y(yr)} Was Received — a Reception Story`,
    blurb: "How a film's reputation was made, unmade, or reversed — with receipts.",
  },
  "parallel-lives": {
    key: "parallel-lives",
    mode: "juxtaposition",
    label: "Parallel Lives",
    deskName: "The Juxtaposition Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} — a Parallel Life From the Real World`,
    blurb: "One real person's life, read against the film that rhymes with it.",
  },
  "field-test": {
    key: "field-test",
    mode: "the_lens",
    label: "Field Test",
    deskName: "The Field Test Desk",
    metaTitle: (t, yr) => `${t}${y(yr)} as a Lens on Real Events — a Field Test`,
    blurb: "Taking the film's core idea out of the theater and testing it on real events.",
  },
  exegesis: {
    key: "exegesis",
    mode: "exegesis",
    label: "Exegesis",
    deskName: "The Accursed Share",
    metaTitle: (t, yr) => `${t}${y(yr)} — an Exegesis`,
    blurb: "A single nodal image, one ontological framework, pushed as far as it goes.",
  },
};

export const DESK_KEYS = Object.keys(DESKS) as DeskKey[];

export function deskByKey(key: string): Desk | null {
  return (DESKS as Record<string, Desk>)[key] ?? null;
}

export function deskByMode(mode: string): Desk | null {
  for (const k of DESK_KEYS) if (DESKS[k].mode === mode) return DESKS[k];
  return null;
}

/** Strip markdown markers for plain-text contexts (meta description, H1). */
export function mdToPlain(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string): string {
  // order matters: links → bold → italic → code
  return s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="nofollow noopener" target="_blank">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * Minimal deterministic markdown → HTML for the essay output contract.
 * Input is escaped first; only the transforms below can introduce tags.
 * The leading H1 (if any) is dropped — the page renders its own H1.
 */
export function essayMdToHtml(md: string): string {
  const src = md.replace(/\r\n/g, "\n").trim();
  const lines = src.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  let firstH1Dropped = false;

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(esc(para.join(" ")))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(
        `<${list.tag}>` + list.items.map((i) => `<li>${inline(esc(i))}</li>`).join("") + `</${list.tag}>`
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote><p>${inline(esc(quote.join(" ")))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flushAll();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      flushAll();
      if (h[1].length === 1 && !firstH1Dropped) {
        firstH1Dropped = true; // page supplies its own H1 from essays.title
        continue;
      }
      const lvl = Math.max(2, Math.min(4, h[1].length));
      out.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) {
      flushAll();
      out.push("<hr />");
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(t);
    if (ul) {
      flushPara();
      flushQuote();
      if (!list || list.tag !== "ul") {
        flushList();
        list = { tag: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(t);
    if (ol) {
      flushPara();
      flushQuote();
      if (!list || list.tag !== "ol") {
        flushList();
        list = { tag: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    if (t.startsWith(">")) {
      flushPara();
      flushList();
      quote.push(t.replace(/^>\s?/, ""));
      continue;
    }
    flushList();
    flushQuote();
    para.push(t);
  }
  flushAll();
  return out.join("\n");
}

export type LinkDict = {
  concepts: { name: string; slug: string }[];
  theorists: { name: string; slug: string }[];
};

/**
 * Full link dictionary: the SM registry RPC + the theory DB (theory_concepts,
 * anon-readable) merged. Theory names dedupe against SM by normalized name
 * (the SM page is richer, so it wins the slug). Parenthetical aliases —
 * "Relationships of Dependence (Amae)" → also "Amae" — are extracted so the
 * short form essays actually use gets linked.
 */
export async function loadFullLinkDict(
  supabase: {
    rpc: (fn: string) => PromiseLike<{ data: unknown }>;
    from: (t: string) => {
      select: (c: string) => {
        order: (c: string, o: { ascending: boolean }) => {
          range: (a: number, b: number) => PromiseLike<{ data: { concept: string; concept_slug: string }[] | null }>;
        };
      };
    };
  }
): Promise<LinkDict> {
  const dict: LinkDict = { concepts: [], theorists: [] };
  const normName = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
  const seen = new Set<string>();
  try {
    const { data } = await supabase.rpc("desk_link_dictionary");
    const base = (data ?? {}) as LinkDict;
    for (const c of base.concepts ?? []) {
      if (!c?.name || !c?.slug) continue;
      dict.concepts.push(c);
      seen.add(normName(c.name));
    }
    dict.theorists = base.theorists ?? [];
  } catch {
    /* enhancement only */
  }
  try {
    for (let from = 0; from < 12000; from += 1000) {
      const { data } = await supabase
        .from("theory_concepts")
        .select("concept, concept_slug")
        .order("id", { ascending: true })
        .range(from, from + 999);
      const batch = data ?? [];
      for (const t of batch) {
        if (!t.concept || !t.concept_slug) continue;
        const key = normName(t.concept);
        if (!seen.has(key)) {
          seen.add(key);
          dict.concepts.push({ name: t.concept, slug: t.concept_slug });
        }
        const paren = /\(([^)]{4,60})\)\s*$/.exec(t.concept);
        if (paren) {
          const alias = paren[1].trim();
          const akey = normName(alias);
          if (alias.length >= 4 && !seen.has(akey)) {
            seen.add(akey);
            dict.concepts.push({ name: alias, slug: t.concept_slug });
          }
        }
      }
      if (batch.length < 1000) break;
    }
  } catch {
    /* theory layer optional */
  }
  return dict;
}

type DictEntry = { name: string; href: string };

/**
 * Link the first mention of known concepts/theorists to their pages.
 * Operates on rendered HTML but only touches text outside tags and outside
 * existing anchors; stored prose is never modified. Case-sensitive whole-word
 * match, longest names first, capped to avoid link soup.
 */
export function linkifyEntities(html: string, dict: LinkDict, maxLinks = 10): string {
  const entries: DictEntry[] = [];
  for (const c of dict.concepts ?? []) {
    if (c?.name && c?.slug && c.name.length >= 4) entries.push({ name: c.name, href: `/concept/${c.slug}` });
  }
  for (const t of dict.theorists ?? []) {
    if (t?.name && t?.slug && t.name.length >= 5) entries.push({ name: t.name, href: `/theorist/${t.slug}` });
  }
  entries.sort((a, b) => b.name.length - a.name.length);

  // split into tag / text segments; never rewrite inside a tag or an <a>…</a>
  const segs = html.split(/(<[^>]+>)/);
  const linked = new Set<string>();
  let links = 0;
  let inAnchor = false;
  let inHeading = false;

  for (let i = 0; i < segs.length && links < maxLinks; i++) {
    const seg = segs[i];
    if (seg.startsWith("<")) {
      const tag = seg.toLowerCase();
      if (tag.startsWith("<a")) inAnchor = true;
      else if (tag.startsWith("</a")) inAnchor = false;
      else if (/^<h[2-4]/.test(tag)) inHeading = true;
      else if (/^<\/h[2-4]/.test(tag)) inHeading = false;
      continue;
    }
    if (inAnchor || inHeading || !seg.trim()) continue;
    let text = seg;
    for (const e of entries) {
      if (links >= maxLinks) break;
      if (linked.has(e.href)) continue;
      // case-insensitive match (dictionary names are lowercase; essays capitalize),
      // but the anchor text keeps the essay's original casing.
      const idx = text.toLowerCase().indexOf(e.name.toLowerCase());
      if (idx === -1) continue;
      const before = text[idx - 1];
      const after = text[idx + e.name.length];
      const boundary = (ch: string | undefined) => ch === undefined || !/[A-Za-z0-9]/.test(ch);
      if (!boundary(before) || !boundary(after)) continue;
      const original = text.slice(idx, idx + e.name.length);
      text =
        text.slice(0, idx) +
        `<a href="${e.href}">${original}</a>` +
        text.slice(idx + e.name.length);
      linked.add(e.href);
      links++;
    }
    segs[i] = text;
  }
  return segs.join("");
}

export function readingMinutes(md: string): number {
  const words = mdToPlain(md).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** First ~155 chars of the dek as a meta description, cut at a word boundary. */
export function metaDescription(dek: string | null, fallback: string): string {
  const s = mdToPlain(dek ?? "") || fallback;
  if (s.length <= 158) return s;
  const cut = s.slice(0, 155);
  return cut.slice(0, Math.max(80, cut.lastIndexOf(" "))) + "…";
}
