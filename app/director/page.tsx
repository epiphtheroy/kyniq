import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ListFilter from "@/components/ListFilter";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Directors — Metatake",
  description: "Every director on Metatake, grouped by nationality — and the recurring readings that make a filmography unmistakably theirs.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Group = "nationality" | "az";
const GROUP_LABEL: Record<Group, string> = { nationality: "By nationality", az: "A–Z" };

// place_of_birth strings are messy (mixed languages + historic forms) — normalise the country.
function normalizeCountry(place: string | null): string {
  if (!place) return "Unknown";
  let s = place.split(",").pop() ?? place;
  s = s.replace(/\[.*?\]/g, "").replace(/[)\]]/g, "").trim().toLowerCase();
  if (!s) return "Unknown";
  const map: [RegExp, string][] = [
    [/^(united states|usa|u\.?s\.?a?\.?|america)$/, "United States"],
    [/^(uk|united kingdom|england|scotland|wales|northern ireland|great britain|britain|birle)/, "United Kingdom"],
    [/(south korea|corea del sur|republic of korea)/, "South Korea"],
    [/^(italy|italia)$/, "Italy"],
    [/^(denmark|danmark)$/, "Denmark"],
    [/(germany|german reich|west germany|east germany|deutschland)/, "Germany"],
    [/(ussr|soviet|russia)/, "Russia / USSR"],
    [/^(france)$/, "France"],
    [/^(spain|españa)$/, "Spain"],
    [/^(japan)$/, "Japan"],
    [/(czechoslovakia|czech republic)/, "Czech Republic"],
    [/(hong kong|british crown colony)/, "Hong Kong"],
  ];
  for (const [re, name] of map) if (re.test(s)) return name;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props { searchParams: Promise<{ group?: string }>; }

export default async function DirectorsIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const group: Group = (sp.group === "az" ? "az" : "nationality");

  const supabase = db();
  const [{ data: filmRows }, { data: dirRows }] = await Promise.all([
    supabase.from("films").select("director, director_slug").not("director_slug", "is", null),
    supabase.from("directors").select("slug, name, place_of_birth"),
  ]);

  const place = new Map<string, string | null>();
  const dname = new Map<string, string>();
  for (const d of (dirRows ?? []) as { slug: string; name: string | null; place_of_birth: string | null }[]) {
    place.set(d.slug, d.place_of_birth ?? null);
    if (d.name) dname.set(d.slug, d.name);
  }

  type Dir = { slug: string; name: string; count: number; country: string };
  const byslug = new Map<string, Dir>();
  for (const f of (filmRows ?? []) as { director: string | null; director_slug: string }[]) {
    const slug = f.director_slug;
    const cur = byslug.get(slug);
    if (cur) cur.count++;
    else byslug.set(slug, { slug, name: dname.get(slug) ?? f.director ?? slug.replace(/-/g, " "), count: 1, country: normalizeCountry(place.get(slug) ?? null) });
  }
  const dirs = [...byslug.values()];
  const total = dirs.length;

  const groups = new Map<string, Dir[]>();
  for (const d of dirs) {
    const k = group === "az" ? (d.name[0] || "#").toUpperCase() : d.country;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(d);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (group === "az") return a[0].localeCompare(b[0]);
    const aLast = a[0] === "Unknown", bLast = b[0] === "Unknown";
    return Number(aLast) - Number(bLast) || b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });
  for (const [, list] of ordered) list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const hrefGroup = (g: Group) => `/director?group=${g}`;

  return (
    <div className="mt">
      <MetatakeNav active="directors" />
      <div className="mt-wrap">
        <h1 className="mt-h1">Directors</h1>
        <div className="mt-tabs">
          {(["nationality", "az"] as Group[]).map((g) => (
            group === g
              ? <span key={g} style={{ color: "var(--ink)" }}>{GROUP_LABEL[g]}</span>
              : <Link key={g} href={hrefGroup(g)}>{GROUP_LABEL[g]}</Link>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--subtle)" }}>{total} directors</span>
        </div>

        <ListFilter targetId="director-list" total={total} placeholder="Filter directors by name…" />
        <div id="director-list">
        {ordered.map(([name, list]) => (
          <div key={name} data-filter-group style={{ marginTop: 14 }}>
            <div className="mt-h2" style={{ fontSize: 13, marginBottom: 6 }}>{name} <span data-filter-count style={{ fontWeight: 350, color: "var(--subtle)" }}>{list.length}</span></div>
            <div className="mt-cols">
              {list.map((d) => (
                <div key={d.slug} data-filter-item data-filter-text={`${d.name} ${d.country}`.toLowerCase()} style={{ marginBottom: 5 }}>
                  <Link href={`/director/${d.slug}`}>{d.name}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>

        {total === 0 && <p style={{ color: "var(--muted)" }}>The catalogue is being assembled.</p>}
      </div>
    </div>
  );
}
