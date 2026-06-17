import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Latest — Metatake",
  description: "The most recently added readings, meta takes, and figure pages on Metatake.",
};

const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"], semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"], ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"], philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"], mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"], reception: ["Reception", "#159A8A"],
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function ago(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${Math.floor(d)}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function LatestPage() {
  const supabase = db();
  const [{ data: takesRaw }, { data: mtsRaw }, { data: figsRaw }] = await Promise.all([
    supabase
      .from("takes")
      .select("id, rationale, register, created_at, source, figure:figures!inner(label, slug, film:films!inner(title, slug)), meta_take:meta_takes(title, slug, status)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("meta_takes").select("slug, title, laconic, created_at").eq("status", "published").eq("kind", "reading").order("created_at", { ascending: false }).limit(12),
    supabase.from("figures").select("slug, label, created_at, film:films!inner(title, slug)").eq("status", "approved").not("slug", "is", null).order("created_at", { ascending: false }).limit(12),
  ]);

  const takes = (takesRaw as unknown as Array<{
    id: string; rationale: string; register: string | null; created_at: string; source: string | null;
    figure: { label: string; slug: string; film: { title: string; slug: string } };
    meta_take: { title: string; slug: string; status: string } | null;
  }>) ?? [];
  const mts = (mtsRaw as Array<{ slug: string; title: string; laconic: string | null; created_at: string }>) ?? [];
  const figs = (figsRaw as unknown as Array<{ slug: string; label: string; created_at: string; film: { title: string; slug: string } }>) ?? [];

  return (
    <div className="mt">
      <MetatakeNav active="latest" />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none" }}>Latest</h1>
        <p className="mt-laconic" style={{ margin: "0 0 14px" }}>What&apos;s newest on Metatake — readings as they&apos;re added.</p>

        <h2 className="mt-h2">Latest readings</h2>
        <ul className="lt-list">
          {takes.map((t) => {
            const reg = t.register ? REG[t.register] : undefined;
            return (
              <li key={t.id} className="lt-item">
                <div className="lt-meta">
                  {reg ? <span className="lt-reg" style={{ background: reg[1] }}>{reg[0]}</span> : null}
                  <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}`} className="lt-fig">{t.figure.label}</Link>
                  <span className="lt-film"> · {t.figure.film.title}</span>
                  {t.source === "human" ? <span className="lt-badge">Community</span> : null}
                  <span className="lt-ago">{ago(t.created_at)}</span>
                </div>
                <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}#t-${t.id}`} className="lt-body">
                  {t.rationale.length > 200 ? t.rationale.slice(0, 200).trim() + "…" : t.rationale}
                </Link>
                {t.meta_take && t.meta_take.status === "published" ? (
                  <div className="lt-hub">→ <Link href={`/take/${t.meta_take.slug}`}>{t.meta_take.title}</Link></div>
                ) : null}
              </li>
            );
          })}
          {takes.length === 0 ? <li className="mt-see">No readings yet.</li> : null}
        </ul>

        {mts.length > 0 && (
          <>
            <h2 className="mt-h2">New meta takes</h2>
            <div className="mt-cols">
              {mts.map((m) => (
                <div key={m.slug} style={{ marginBottom: 6 }}>
                  <Link href={`/take/${m.slug}`}>{m.title}</Link>
                  {m.laconic ? <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.laconic}</div> : null}
                </div>
              ))}
            </div>
          </>
        )}

        {figs.length > 0 && (
          <>
            <h2 className="mt-h2">New figure pages</h2>
            <div className="mt-cols">
              {figs.map((f) => (
                <div key={`${f.film.slug}-${f.slug}`} style={{ marginBottom: 6 }}>
                  <Link href={`/film/${f.film.slug}/figure/${f.slug}`}>{f.label}</Link>{" "}
                  <Link href={`/film/${f.film.slug}`} style={{ color: "var(--subtle)" }}>{f.film.title}</Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
