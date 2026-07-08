/**
 * Wikidata person basics for theorist pages (2026-07-08) — portrait, life
 * dates, one-line description. Fetched from the public EntityData endpoint
 * (CC0), cached a week; every field is optional and the page renders without
 * any of them. QIDs come from lib/theorist_qid.json (machine-verified).
 */

export type WdPerson = {
  image: string | null;      // Commons FilePath URL, width-capped
  birth: number | null;      // year
  death: number | null;      // year
  description: string | null;
};

type WdClaims = Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;

const yearFromTime = (v: unknown): number | null => {
  const t = (v as { time?: string } | undefined)?.time;
  const m = t?.match(/^([+-]\d{4,})/);
  return m ? Number(m[1]) : null;
};

export async function wdPerson(qid: string): Promise<WdPerson | null> {
  try {
    const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { accept: "application/json" },
      next: { revalidate: 604800 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { entities?: Record<string, { claims?: WdClaims; descriptions?: Record<string, { value: string }> }> };
    const e = j.entities?.[qid];
    if (!e) return null;
    const claim = (p: string) => e.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
    const imgFile = claim("P18") as string | undefined;
    return {
      image: imgFile ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imgFile)}?width=400` : null,
      birth: yearFromTime(claim("P569")),
      death: yearFromTime(claim("P570")),
      description: e.descriptions?.en?.value ?? null,
    };
  } catch {
    return null;
  }
}
