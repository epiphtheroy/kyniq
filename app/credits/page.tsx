import { Suspense } from "react";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import CreditsExplorer from "./CreditsExplorer";
import { personSlug } from "./credits-logic";
import crewIndex from "@/lib/crew_index.json";
import "./credits.css";

export const metadata: Metadata = {
  title: "Credits — follow the credits",
  description:
    "Every film is signed by more than its director. Follow the cinematographer, editor, composer or designer of a film you loved through their whole body of work — where to begin, the essentials, the deep cuts, and the repertory company they keep.",
  alternates: { canonical: "/credits" },
};

type CrewPerson = { id: number; name: string; n: number; c: string[] };

// A–Z crawl index — the explorer above is client-only, so this listing is the
// crawlable HTML surface for every /credits/[person] read page.
function azGroups(): [string, CrewPerson[]][] {
  const people = (crewIndex as unknown as { people: CrewPerson[] }).people;
  const groups = new Map<string, CrewPerson[]>();
  for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
    const ch = (p.name.normalize("NFD").replace(/[̀-ͯ]/g, "")[0] ?? "#").toUpperCase();
    const letter = /[A-Z]/.test(ch) ? ch : "#";
    const arr = groups.get(letter) ?? [];
    arr.push(p);
    groups.set(letter, arr);
  }
  return [...groups.entries()].sort((a, b) => (a[0] === "#" ? 1 : b[0] === "#" ? -1 : a[0].localeCompare(b[0])));
}

export default function CreditsPage() {
  const groups = azGroups();
  const total = groups.reduce((s, [, ppl]) => s + ppl.length, 0);
  return (
    <div className="mt">
      <SiteNav />
      <Suspense fallback={<div style={{ padding: "48px 24px", color: "#6B6B6B" }}>Loading…</div>}>
        <CreditsExplorer />
      </Suspense>

      <div className="mt-wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <section aria-labelledby="cr-az">
          <h2 className="df-h2" id="cr-az">Every crew page, A–Z</h2>
          <p className="df-sub">
            All {total.toLocaleString()} cinematographers, writers, editors, composers and production designers with three
            or more films in the Metatake catalog — each with a full read page: where to begin, the essentials, and the
            repertory company they keep.
          </p>
          <nav aria-label="Jump to letter" style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600 }}>
            {groups.map(([letter]) => (
              <a key={letter} href={`#cr-${letter === "#" ? "num" : letter.toLowerCase()}`}>{letter}</a>
            ))}
          </nav>
          {groups.map(([letter, ppl]) => (
            <div key={letter} style={{ marginTop: 24 }}>
              <h3 id={`cr-${letter === "#" ? "num" : letter.toLowerCase()}`} style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>{letter}</h3>
              <div className="th-grid">
                {ppl.map((p) => (
                  <a className="th-row" key={p.id} href={`/credits/${personSlug(p.name, p.id)}`}>
                    <span className="th-name">{p.name}</span>
                    <span className="th-n">{p.n}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
