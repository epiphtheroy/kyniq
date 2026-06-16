import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ListFilter from "@/components/ListFilter";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Films — Metatake",
  description: "Every film on Metatake, grouped by genre or decade — each broken into its figures and the meta takes they carry.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Group = "genre" | "decade";
const GROUP_LABEL: Record<Group, string> = { genre: "By genre", decade: "By decade" };

interface Props { searchParams: Promise<{ group?: string }>; }

type Film = { slug: string; title: string; year: number | null; director: string | null; genres: string[] | null };

export default async function FilmsIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const group: Group = (sp.group === "decade" ? "decade" : "genre");

  const supabase = db();
  const { data } = await supabase
    .from("films")
    .select("slug, title, year, director, genres")
    .order("year", { ascending: false });
  const films = (data ?? []) as Film[];
  const total = films.length;

  const groups = new Map<string, Film[]>();
  for (const f of films) {
    if (group === "decade") {
      const k = f.year ? `${Math.floor(f.year / 10) * 10}s` : "Unknown";
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(f);
    } else {
      const gs = f.genres && f.genres.length ? f.genres : ["Other"];
      for (const g of gs) (groups.get(g) ?? groups.set(g, []).get(g)!).push(f);
    }
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    if (group === "decade") return b[0].localeCompare(a[0]); // newest decade first
    const aLast = a[0] === "Other", bLast = b[0] === "Other";
    return Number(aLast) - Number(bLast) || b[1].length - a[1].length || a[0].localeCompare(b[0]);
  });

  const hrefGroup = (g: Group) => `/film?group=${g}`;

  return (
    <div className="mt">
      <MetatakeNav active="films" />
      <div className="mt-wrap">
        <h1 className="mt-h1">Films</h1>
        <div className="mt-tabs">
          {(["genre", "decade"] as Group[]).map((g) => (
            group === g
              ? <span key={g} style={{ color: "var(--ink)" }}>{GROUP_LABEL[g]}</span>
              : <Link key={g} href={hrefGroup(g)}>{GROUP_LABEL[g]}</Link>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--subtle)" }}>{total} films</span>
        </div>

        <ListFilter targetId="film-list" total={total} placeholder="Filter films by title or director…" />
        <div id="film-list">
        {ordered.map(([name, list]) => (
          <div key={name} data-filter-group style={{ marginTop: 14 }}>
            <div className="mt-h2" style={{ fontSize: 13, marginBottom: 6 }}>{name} <span data-filter-count style={{ fontWeight: 350, color: "var(--subtle)" }}>{list.length}</span></div>
            <div className="mt-cols">
              {list.map((f) => (
                <div key={f.slug} data-filter-item data-filter-text={`${f.title} ${f.director ?? ""} ${f.year ?? ""}`.toLowerCase()} style={{ marginBottom: 5 }}>
                  <Link href={`/film/${f.slug}`}>{f.title}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>({f.year ?? "?"})</span>
                  {f.director ? <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{f.director}</div> : null}
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
