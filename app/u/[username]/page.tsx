import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensQuickBar from "@/components/LensQuickBar";
import { avatarColor } from "@/lib/talk/config";
import "@/app/talk.css";

// Public (noindex) portfolio: the two RPCs only change when the user logs
// activity, so serve an edge-cached page (ISR) and cache the fetch per username
// in the Data Cache. Tagged portfolio:<username> so a profile update can bust it
// on demand via /api/revalidate; also refreshes at most every 5 minutes.
//
// Talk layer (plan: /admin/docs/talk-layer §2.6): this page is also where a
// name-click in a Talk thread lands, so it now appends the author's published
// Talk history — and when someone has no public portfolio but does talk, it
// falls back to a minimal face (avatar · bio · history) instead of a 404.
export const revalidate = 300;
// Empty list enables the on-demand Full Route Cache (ISR HIT) without
// prebuilding anything at build time.
export async function generateStaticParams() { return []; }

const W342 = "https://image.tmdb.org/t/p/w342";

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Meta = {
  username: string; display_name: string | null; bio: string | null; avatar_url: string | null;
  seen_count: number; watchlist_count: number; rated_count: number;
  avg_prestige: number | null; nav: number | null;
};
type Film = { film_id: string; slug: string; title: string; year: number | null; poster_path: string | null; prestige: number | null };

type TalkProfile = {
  id: string; username: string | null; display_name: string | null; bio: string | null;
  avatar_url: string | null; first_love_key: string | null; created_at: string;
};
type TalkRow = {
  id: string; addr_type: string; addr_key: string; film_key: string | null;
  parent_id: string | null; body: string; created_at: string;
};

interface Props { params: Promise<{ username: string }> }

// One cache entry per username, shared by generateMetadata and the page render.
function loadPortfolio(username: string) {
  return unstable_cache(
    async () => {
      const supabase = supabaseAnon();
      const [{ data: metaRaw }, { data: filmsRaw }] = await Promise.all([
        supabase.rpc("public_portfolio_meta", { p_username: username }),
        supabase.rpc("public_portfolio", { p_username: username }),
      ]);
      return {
        meta: (metaRaw as Meta | null),
        films: ((filmsRaw as Film[] | null) ?? []),
      };
    },
    ["public-portfolio", username],
    { revalidate: 300, tags: [`portfolio:${username}`] },
  )();
}

// Talk history — small anon reads, refreshed with the same ISR window. Returns
// null profile when the username is unknown or not public (talk_posts may not
// exist yet on envs where 0139 hasn't applied; the catch keeps the page whole).
async function loadTalk(username: string): Promise<{ profile: TalkProfile | null; posts: TalkRow[]; hearts: number }> {
  const supabase = supabaseAnon();
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, first_love_key, created_at")
    .eq("username", username)
    .eq("is_public", true)
    .maybeSingle();
  if (!prof) return { profile: null, posts: [], hearts: 0 };
  const profile = prof as TalkProfile;
  try {
    const { data: postData } = await supabase
      .from("talk_posts")
      .select("id, addr_type, addr_key, film_key, parent_id, body, created_at")
      .eq("author_id", profile.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(20);
    const posts = (postData ?? []) as TalkRow[];
    let hearts = 0;
    if (posts.length) {
      const { data: lc } = await supabase
        .from("talk_like_counts")
        .select("post_id, likes")
        .in("post_id", posts.map((p) => p.id));
      if (lc) hearts = (lc as { likes: number }[]).reduce((a, r) => a + r.likes, 0);
    }
    return { profile, posts, hearts };
  } catch {
    return { profile, posts: [], hearts: 0 };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const { meta: m } = await loadPortfolio(username);
  const name = m?.display_name || username;
  return {
    title: `${name} — film portfolio`,
    description: m ? `${name} has logged ${m.seen_count} films on Metatake — a portfolio worth ${m.nav ?? 0} in cumulative prestige.` : `${username} on Metatake.`,
    alternates: { canonical: `/u/${username}` },
    robots: { index: false, follow: false },
  };
}

function prettySlug(s: string): string {
  return s.replace(/-/g, " ").toUpperCase();
}

function addrHref(p: TalkRow): string {
  if (p.addr_type === "director") return `/director/${p.addr_key}`;
  if (p.addr_type === "score" && p.film_key) return `/takescore/film/${p.film_key}`;
  if (p.addr_type === "figure" && p.film_key) return `/film/${p.film_key}`;
  return `/film/${p.film_key ?? p.addr_key}`;
}

function TalkHistory({ profile, posts, hearts }: { profile: TalkProfile; posts: TalkRow[]; hearts: number }) {
  if (!posts.length) return null;
  const name = profile.display_name || profile.username || "?";
  const initial = name.charAt(0).toUpperCase();
  const color = avatarColor(profile.username || profile.id);
  return (
    <section style={{ marginTop: 28 }}>
      <div className="seclbl">
        Talk · {posts.length} notes{hearts > 0 ? ` · ♥ ${hearts} received` : ""}
      </div>
      {posts.map((p) => (
        <div key={p.id} className="tk-msg">
          <span className="tk-av" style={{ background: color }} aria-hidden="true">{initial}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="tk-mhead">
              <Link className={`tk-chip ${p.addr_type}`} href={addrHref(p)}>
                {p.addr_type === "figure" ? "◈ " : ""}
                {prettySlug(p.addr_key)}
              </Link>
              {p.parent_id ? <span className="tk-time">reply</span> : null}
              <span className="tk-time">
                {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="tk-body">{p.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export default async function PortfolioPage({ params }: Props) {
  const { username } = await params;

  const [{ meta, films }, talk] = await Promise.all([loadPortfolio(username), loadTalk(username)]);
  if (!meta && !talk.profile) notFound();

  // ── Fallback face: no public portfolio, but a real Talk presence ──────────
  if (!meta) {
    const profile = talk.profile as TalkProfile;
    const name = profile.display_name || profile.username || username;
    const since = new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return (
      <main className="mt-wrap">
        <SiteNav />
        <div className="mt">
          <div className="up-head">
            <div className="up-av disp" style={{ background: avatarColor(profile.username || profile.id), color: "#fff" }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="up-id">
              <h1 className="disp" style={{ fontSize: 25, margin: 0 }}>{name}</h1>
              <div className="ui muted" style={{ fontSize: 13, marginTop: 2 }}>@{profile.username} · talking since {since}</div>
              {profile.bio && <p className="body" style={{ fontSize: 15.5, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "58ch" }}>{profile.bio}</p>}
            </div>
          </div>
          {talk.posts.length === 0 ? (
            <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "18px 0 0" }}>A quiet seat, so far.</p>
          ) : (
            <TalkHistory profile={profile} posts={talk.posts} hearts={talk.hearts} />
          )}
        </div>
      </main>
    );
  }

  const name = meta.display_name || meta.username;
  const initial = (name || "?").charAt(0).toUpperCase();

  return (
    <main className="mt-wrap">
      <SiteNav />
      <div className="mt">
        {/* Header */}
        <div className="up-head">
          <div className="up-av disp">{initial}</div>
          <div className="up-id">
            <h1 className="disp" style={{ fontSize: 25, margin: 0 }}>{name}</h1>
            <div className="ui muted" style={{ fontSize: 13, marginTop: 2 }}>@{meta.username} · film portfolio</div>
            {meta.bio && <p className="body" style={{ fontSize: 15.5, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "58ch" }}>{meta.bio}</p>}
          </div>
        </div>

        <LensQuickBar />

        {/* NAV-style KPI strip */}
        <div className="me-kpi">
          <div className="me-k"><b>{meta.seen_count}</b><span>Films seen</span></div>
          <div className="me-k"><b>{meta.nav ?? 0}</b><span>NAV (Σ prestige)</span></div>
          <div className="me-k"><b>{meta.avg_prestige ?? "—"}</b><span>Avg prestige</span></div>
          <div className="me-k"><b>{meta.watchlist_count}</b><span>Watchlist</span></div>
        </div>

        {/* Portfolio grid */}
        <section style={{ marginTop: 24 }}>
          <div className="seclbl">Holdings · {films.length} films, by prestige</div>
          {films.length === 0 ? (
            <p className="ui muted" style={{ fontSize: 14, fontStyle: "italic", margin: "10px 0 0" }}>
              No public films yet.
            </p>
          ) : (
            <div className="up-grid">
              {films.map((f) => (
                <Link key={f.film_id} href={`/film/${f.slug}`} className="up-card">
                  <span className="up-poster">
                    {f.poster_path ? <img src={`${W342}${f.poster_path}`} alt={f.title} loading="lazy" /> : <span className="up-noposter">{f.title.charAt(0)}</span>}
                    {f.prestige != null && <span className="up-pscore">{Math.round(Number(f.prestige))}</span>}
                  </span>
                  <span className="up-t">{f.title}</span>
                  {f.year ? <span className="up-y">{f.year}</span> : null}
                </Link>
              ))}
            </div>
          )}
        </section>

        {talk.profile ? <TalkHistory profile={talk.profile} posts={talk.posts} hearts={talk.hearts} /> : null}

        <p className="ui muted" style={{ fontSize: 12, marginTop: 26, fontStyle: "italic" }}>
          A Metatake portfolio scores each film you&apos;ve seen by its standing in the canon. NAV is the sum of that prestige.
        </p>
      </div>
    </main>
  );
}
