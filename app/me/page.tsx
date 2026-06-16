import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import MetatakeNav from "@/components/MetatakeNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My dashboard — Metatake",
  description: "Your followed films, figures and meta-takes, what you liked, and the takes you've written.",
  robots: { index: false, follow: false },
};

type Pin = { kind: string; entity_type: string; slug: string | null; film_slug: string | null; title: string | null; sub: string | null };

function hrefOf(p: Pin): string | null {
  if (p.entity_type === "film" && p.slug) return `/film/${p.slug}`;
  if (p.entity_type === "meta_take" && p.slug) return `/take/${p.slug}`;
  if (p.entity_type === "figure" && p.slug && p.film_slug) return `/film/${p.film_slug}/figure/${p.slug}`;
  return null;
}
const KIND_LABEL: Record<string, string> = { film: "Film", meta_take: "Meta take", figure: "Figure" };

function PinList({ pins }: { pins: Pin[] }) {
  if (pins.length === 0) return <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>Nothing here yet.</p>;
  return (
    <ul className="me-list mt" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {pins.map((p, i) => {
        const href = hrefOf(p);
        return (
          <li key={i} style={{ padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
            <span className="ui muted" style={{ fontSize: 11, letterSpacing: ".09em", textTransform: "uppercase", marginRight: 8 }}>{KIND_LABEL[p.entity_type] ?? p.entity_type}</span>
            {href ? <Link href={href} style={{ fontSize: 16 }}>{p.title ?? "—"}</Link> : <span style={{ fontSize: 16 }}>{p.title ?? "—"}</span>}
            {p.sub && <span className="ui muted" style={{ fontSize: 13, marginLeft: 8 }}>{p.sub}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default async function MeDashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login?next=/me");

  const { data: profile } = await supabase.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle();
  const name = profile?.display_name || profile?.username || user.email?.split("@")[0] || "you";

  const [{ data: pinsRaw }, { data: takesRaw }] = await Promise.all([
    supabase.rpc("get_my_pins"),
    supabase
      .from("takes")
      .select("id, rationale, register, status, created_at, meta_take:meta_takes(title, slug), figure:figures!inner(label, slug, film:films!inner(title, slug))")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const pins: Pin[] = (pinsRaw as Pin[] | null) ?? [];
  const follows = pins.filter((p) => p.kind === "follow");
  const likes = pins.filter((p) => p.kind === "like");
  const takes = (takesRaw as unknown as Array<{
    id: string; rationale: string; register: string | null; status: string; created_at: string;
    meta_take: { title: string; slug: string } | null;
    figure: { label: string; slug: string; film: { title: string; slug: string } };
  }>) ?? [];

  return (
    <main className="mt-wrap">
      <MetatakeNav />
      <div className="mt">
        <h1 className="disp" style={{ fontSize: 26, margin: "18px 0 2px" }}>My dashboard</h1>
        <p className="ui muted" style={{ fontSize: 13, margin: 0 }}>
          Signed in as <strong style={{ color: "var(--ink)" }}>{name}</strong>
          {profile?.username && <> · <Link href={`/u/${profile.username}`} className="mt-link">public profile</Link></>}
          {" "}· <Link href="/settings" className="mt-link">settings</Link>
        </p>

        <section style={{ marginTop: 22 }}>
          <div className="seclbl">📌 Following · {follows.length}</div>
          <PinList pins={follows} />
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">♥ Liked · {likes.length}</div>
          <PinList pins={likes} />
        </section>

        <section style={{ marginTop: 26 }}>
          <div className="seclbl">My takes · {takes.length}</div>
          {takes.length === 0 ? (
            <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "8px 0 0" }}>
              You haven&apos;t written any takes yet. Open a figure and add your reading.
            </p>
          ) : (
            <ul className="me-list" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
              {takes.map((t) => (
                <li key={t.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--hairline)" }}>
                  <div className="ui muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    <Link href={`/film/${t.figure.film.slug}/figure/${t.figure.slug}`} style={{ color: "var(--lk-fig)", textDecoration: "none" }}>{t.figure.label}</Link>
                    <span style={{ color: "var(--subtle)" }}> · {t.figure.film.title}</span>
                    {t.register && <span style={{ color: "var(--subtle)" }}> · {t.register}</span>}
                    {t.status !== "published" && <span className="accent"> · {t.status}</span>}
                  </div>
                  <p className="body" style={{ fontSize: 15.5, lineHeight: 1.5, margin: 0, maxWidth: "62ch" }}>
                    {t.rationale.slice(0, 220)}{t.rationale.length > 220 ? "…" : ""}
                  </p>
                  {t.meta_take?.slug && (
                    <div className="ui" style={{ fontSize: 12, marginTop: 4 }}>
                      under <Link href={`/take/${t.meta_take.slug}`} className="mt-link">{t.meta_take.title}</Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
