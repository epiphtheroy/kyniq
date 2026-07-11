import Link from "next/link";

/**
 * ConceptDomainRail — the top level of the concept hierarchy (domain → field →
 * concept), rendered as a rail of domain cards. Server-rendered so every domain
 * link is crawlable. Each card leads with how many of its concepts are actually
 * "on screen" (staged by ≥1 film) — the value signal — with the full registry
 * size as a muted secondary. Domains with nothing on screen (e.g. Literature)
 * are dropped by the caller: an empty shelf helps no one and dilutes SEO.
 */
export type DomainCount = { part: string; concepts: number; live: number };

const SLUG: Record<string, string> = {
  Politics: "politics", Criticism: "criticism", Economics: "economics", Culture: "culture",
  Society: "society", Psychology: "psychology", Family: "family", Art: "art",
  Medicine: "medicine", Management: "management", Law: "law", History: "history",
  Nature: "nature", Literature: "literature",
};

// one-line "what is unintelligible here that these concepts name" gloss
const GLOSS: Record<string, string> = {
  Criticism: "How meaning, form and power work in a text",
  Psychology: "The mind's hidden mechanics — desire, memory, the unconscious",
  Culture: "Myth, media and the codes we live inside",
  Art: "Beauty, the sublime, and why images move us",
  Society: "Power, class, ritual and the shape of the collective",
  Politics: "Ideology, the state, resistance and rule",
  History: "Time, memory and how the past is made",
  Management: "Organization, work and how groups decide",
  Nature: "Life, environment and the non-human",
  Law: "Justice, norm and the force of the rule",
  Economics: "Value, exchange and the logic of scarcity",
  Medicine: "The body, illness, the clinic and care",
  Family: "Kinship, intimacy and the domestic bond",
  Literature: "Narrative, genre and the written word",
};

export default function ConceptDomainRail({ domains }: { domains: DomainCount[] }) {
  const shown = domains.filter((d) => d.live > 0).sort((a, b) => b.live - a.live);

  return (
    <div className="cdr">
      <h2 className="cdr-head">Browse by domain</h2>
      <p className="cdr-sub">Fourteen fields of thought. The number is how many of each domain&rsquo;s concepts are already staged by a film.</p>
      <div className="cdr-grid">
        {shown.map((d) => (
          <Link key={d.part} href={`/concept/domain/${SLUG[d.part] ?? d.part.toLowerCase()}`} className="cdr-card">
            <span className="cdr-name">{d.part}</span>
            <span className="cdr-gloss">{GLOSS[d.part] ?? ""}</span>
            <span className="cdr-n"><b>{d.live.toLocaleString()}</b> on screen <i>of {d.concepts.toLocaleString()}</i></span>
          </Link>
        ))}
      </div>
      <style>{`
        .cdr{margin:6px 0 4px}
        .cdr-head{font-family:var(--font-display);font-size:19px;font-weight:700;margin:0 0 4px;color:var(--ink)}
        .cdr-sub{font-family:var(--font-ui);font-size:13.5px;color:var(--muted);margin:0 0 14px;max-width:64ch}
        .cdr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
        .cdr-card{display:flex;flex-direction:column;gap:5px;padding:14px 15px;border:1px solid var(--hairline);border-radius:12px;background:var(--surface,rgba(0,0,0,.015));text-decoration:none;color:var(--ink);transition:border-color .12s,transform .12s,box-shadow .12s}
        .cdr-card:hover{border-color:var(--accent,#e3120b);transform:translateY(-2px);box-shadow:0 8px 22px -14px rgba(0,0,0,.4)}
        .cdr-name{font-family:var(--font-display);font-size:17px;font-weight:700}
        .cdr-gloss{font-family:var(--font-ui);font-size:12px;line-height:1.4;color:var(--muted);flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .cdr-n{font-family:var(--font-ui);font-size:12px;color:var(--subtle,#888)}
        .cdr-n b{color:var(--accent,#e3120b);font-weight:700;font-size:13px}
        .cdr-n i{font-style:normal;opacity:.8}
      `}</style>
    </div>
  );
}
