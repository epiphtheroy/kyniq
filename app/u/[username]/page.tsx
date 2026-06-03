import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} — Kyniq`, description: `Film readings by ${username} on Kyniq.` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = supabaseAnon();

  // Try by username first, then by id (users without username set)
  let profile;
  const { data: byUsername } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, reputation, is_public, role, created_at")
    .eq("username", username)
    .single();

  if (byUsername) {
    profile = byUsername;
  } else {
    // Try by id (for users who haven't set a username yet)
    const { data: byId } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, reputation, is_public, role, created_at")
      .eq("id", username)
      .single();
    profile = byId;
  }

  if (!profile || !profile.is_public) notFound();

  // Get contributions (readings)
  const { data: readings } = await supabase
    .from("contributions")
    .select("id, body, upvotes, merged_into_canonical, created_at, question:questions!inner(title, slug, film:films!inner(title, slug))")
    .eq("author_id", profile.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get questions
  const { data: questions } = await supabase
    .from("questions")
    .select("id, title, slug, created_at, film:films!inner(title, slug)")
    .eq("author_id", profile.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  // Get badges
  const { data: userBadges } = await supabase
    .from("user_badges")
    .select("badge:badges!inner(key, name, tier)")
    .eq("user_id", profile.id);

  // Count merged
  const { count: mergedCount } = await supabase
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("author_id", profile.id)
    .eq("merged_into_canonical", true);

  const initial = (profile.display_name || profile.username || "?").charAt(0).toUpperCase();
  const joinYear = new Date(profile.created_at).getFullYear();

  return (
    <main className="shell">
      {/* Profile header */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div className="avatar disp" style={{ width: 52, height: 52, fontSize: 20, background: "var(--bg)" }}>
          {initial}
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="disp" style={{ fontSize: 23, margin: 0 }}>{profile.username}</h1>
          <div className="ui accent" style={{ fontSize: 13, marginTop: 4 }}>
            merged into {mergedCount ?? 0} canonical answer{(mergedCount ?? 0) !== 1 ? "s" : ""} · reputation {profile.reputation ?? 0}
          </div>
          {profile.bio && (
            <p className="body" style={{ fontSize: 16, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "58ch" }}>
              {profile.bio} Joined {joinYear}.
            </p>
          )}
        </div>
      </div>

      <hr className="rule" />

      {/* Badges */}
      {(userBadges ?? []).length > 0 && (
        <>
          <div className="seclbl">Badges</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 11 }}>
            {(userBadges ?? []).map((ub: any, i: number) => {
              const badge = ub.badge as { key: string; name: string; tier: string | null };
              const isMarquee = badge.tier === "marquee";
              return (
                <span key={i} className={`badge ${isMarquee ? "marquee" : ""}`}>
                  {badge.name}
                </span>
              );
            })}
          </div>
          <hr className="rule" />
        </>
      )}

      {/* Tabs: Readings / Questions */}
      <div style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
        <span className="tab active" style={{ fontSize: 11.5, letterSpacing: ".13em", textTransform: "uppercase", paddingBottom: 5 }}>
          Readings ({readings?.length ?? 0})
        </span>
        <span className="tab" style={{ fontSize: 11.5, letterSpacing: ".13em", textTransform: "uppercase" }}>
          Questions ({questions?.length ?? 0})
        </span>
      </div>

      {/* Readings list */}
      <div style={{ marginTop: 16 }}>
        {(readings ?? []).map((r: any) => {
          const q = r.question as { title: string; slug: string; film: { title: string; slug: string } };
          return (
            <div key={r.id} style={{ paddingBottom: 13, borderBottom: "1px solid var(--hairline)", marginBottom: 13 }}>
              <Link href={`/film/${q.film.slug}/q/${q.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <p className="body" style={{ fontSize: 16.5, lineHeight: 1.55, margin: 0, maxWidth: "60ch" }}>
                  {r.body.slice(0, 200)}{r.body.length > 200 ? "…" : ""}
                </p>
                <div className="ui muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {q.film.title}
                  {r.merged_into_canonical && <span className="accent"> · merged into the canonical answer</span>}
                  {" "}· ▲ {r.upvotes}
                </div>
              </Link>
            </div>
          );
        })}
        {(!readings || readings.length === 0) && (
          <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic" }}>No readings yet.</p>
        )}
      </div>
    </main>
  );
}
