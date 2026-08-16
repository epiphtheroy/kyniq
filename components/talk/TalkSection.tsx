"use client";

/**
 * TalkSection — one conversation per world-address (film · director), mounted
 * at the bottom of the entity's main page. Walking skeleton of the plan at
 * /admin/docs/talk-layer: seed question (Metatake asks), notes + one reply
 * level, human-only hearts, JIT auth via the AuthSheet event bus. Client-side
 * on purpose: the page's ISR HTML stays identical for everyone (no server
 * personalization) and comments stay out of the crawlable HTML for now.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { getUserSafe } from "@/lib/supabase/safeAuth";
import { requireAuthEvent } from "@/lib/conversion/bus";
import { avatarColor, TALK_APPS } from "@/lib/talk/config";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Author = { username: string | null; display_name: string | null } | null;

interface TalkPost {
  id: string;
  addr_type: string;
  addr_key: string;
  film_key: string | null;
  parent_id: string | null;
  author_id: string | null;
  author_app: string | null;
  body: string;
  status: string;
  created_at: string;
  author: Author;
}

interface SeedQuestion {
  title: string;
  slug: string;
}

/** Faint example sentences for the composer — the voice bank's surviving
 *  export (08-08: apps shelved; the placeholder models the register instead).
 *  Stable pick per address so the prompt doesn't flicker between renders. */
const STARTERS = [
  "The scene I can't shake is…",
  "Say what the reading missed…",
  "I watched it last night, and…",
  "The score feels wrong to me because…",
  "Nobody talks about the moment when…",
  "I didn't understand the ending until…",
];
function starterFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return STARTERS[h % STARTERS.length];
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function authorName(p: TalkPost): string {
  if (p.author_app) return TALK_APPS[p.author_app]?.name ?? p.author_app;
  return p.author?.display_name || p.author?.username || "someone";
}

function beacon(ev: string, addr: string) {
  try {
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: "click", path: window.location.pathname, props: { ev, addr } }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* metrics must never break posting */
  }
}

export default function TalkSection({
  addrType,
  addrKey,
  title,
  rollupFilmKeys,
}: {
  addrType: "film" | "director";
  addrKey: string;
  title: string;
  /** director pages: film slugs whose talk rolls up here (plan §2 layer 3) */
  rollupFilmKeys?: string[];
}) {
  const [posts, setPosts] = useState<TalkPost[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [uid, setUid] = useState<string | null>(null);
  const [seed, setSeed] = useState<SeedQuestion | null>(null);
  const [tab, setTab] = useState<"top" | "new">("top");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    const c = sb();
    let q = c
      .from("talk_posts")
      .select(
        "id, addr_type, addr_key, film_key, parent_id, author_id, author_app, body, status, created_at, author:profiles!talk_posts_author_id_fkey(username, display_name)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(200);
    if (addrType === "film") {
      q = q.or(`film_key.eq.${addrKey},and(addr_type.eq.film,addr_key.eq.${addrKey})`);
    } else {
      const keys = (rollupFilmKeys ?? []).filter(Boolean).slice(0, 100);
      if (keys.length) {
        q = q.or(`and(addr_type.eq.director,addr_key.eq.${addrKey}),film_key.in.(${keys.join(",")})`);
      } else {
        q = q.eq("addr_type", "director").eq("addr_key", addrKey);
      }
    }
    const { data, error: err } = await q;
    if (err || !data) return; // table may not exist yet on stale envs — stay quiet
    const rows = data as unknown as TalkPost[];
    setPosts(rows);
    const ids = rows.map((p) => p.id);
    if (ids.length) {
      const { data: lc } = await c.from("talk_like_counts").select("post_id, likes").in("post_id", ids);
      if (lc) {
        const m: Record<string, number> = {};
        for (const r of lc as { post_id: string; likes: number }[]) m[r.post_id] = r.likes;
        setLikes(m);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrType, addrKey, (rollupFilmKeys ?? []).join(",")]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = sb();
      await load();
      const user = await getUserSafe(c);
      if (!alive) return;
      if (user) {
        setUid(user.id);
        const { data: ml } = await c.from("talk_likes").select("post_id").eq("user_id", user.id);
        if (alive && ml) setMyLikes(new Set((ml as { post_id: string }[]).map((r) => r.post_id)));
      }
      if (addrType === "film") {
        const { data: qs } = await c
          .from("questions")
          .select("title, slug, films!inner(slug)")
          .eq("films.slug", addrKey)
          .eq("status", "published")
          .order("created_at", { ascending: true })
          .limit(1);
        if (alive && qs && qs.length) {
          const first = qs[0] as unknown as SeedQuestion;
          setSeed({ title: first.title, slug: first.slug });
        }
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [addrType, addrKey, load]);

  const roots = useMemo(() => {
    const tops = posts.filter((p) => !p.parent_id);
    const score = (p: TalkPost) => likes[p.id] ?? 0;
    const sorted = [...tops];
    if (tab === "top") sorted.sort((a, b) => score(b) - score(a) || b.created_at.localeCompare(a.created_at));
    else sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted;
  }, [posts, likes, tab]);

  const repliesOf = useCallback(
    (id: string) => posts.filter((p) => p.parent_id === id),
    [posts]
  );

  const submit = useCallback(
    async (parentId: string | null) => {
      const body = (parentId ? replyText : text).trim();
      if (!body) return;
      if (!uid) {
        requireAuthEvent({ ctx: { kind: "save", verb: "save" } });
        return;
      }
      if (inflight.current) return; // double-click guard — one note per tap
      inflight.current = true;
      setBusy(true);
      setError(null);
      setNotice(null);
      const c = sb();
      const { data, error: err } = await c
        .from("talk_posts")
        .insert({
          addr_type: addrType,
          addr_key: addrKey,
          film_key: addrType === "film" ? addrKey : null,
          parent_id: parentId,
          author_id: uid,
          body,
        })
        .select("id, status")
        .maybeSingle();
      inflight.current = false;
      setBusy(false);
      if (err) {
        const msg = err.message.includes("rate limit") || err.message.includes("limited to")
          ? "Easy there — a few notes per hour is the house limit. Try again soon."
          : "Couldn't post that note. Try again in a moment.";
        setError(msg);
        return;
      }
      if (parentId) setReplyText("");
      else setText("");
      setReplyTo(null);
      if (data && (data as { status: string }).status === "held") {
        setNotice("Your note has a link in it, so it's held for a quick review — it will appear once approved.");
      }
      beacon(parentId ? "talk_reply" : "talk_post", `${addrType}:${addrKey}`);
      await load();
    },
    [uid, text, replyText, addrType, addrKey, load]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!uid) {
        requireAuthEvent({ ctx: { kind: "save", verb: "save" } });
        return;
      }
      const on = myLikes.has(postId);
      setMyLikes((s) => {
        const n = new Set(s);
        if (on) n.delete(postId);
        else n.add(postId);
        return n;
      });
      setLikes((m) => ({ ...m, [postId]: Math.max(0, (m[postId] ?? 0) + (on ? -1 : 1)) }));
      const c = sb();
      if (on) await c.from("talk_likes").delete().eq("post_id", postId).eq("user_id", uid);
      else await c.from("talk_likes").insert({ post_id: postId, user_id: uid });
    },
    [uid, myLikes]
  );

  const softDelete = useCallback(
    async (postId: string) => {
      if (!uid) return;
      const c = sb();
      await c.from("talk_posts").update({ status: "deleted" }).eq("id", postId).eq("author_id", uid);
      await load();
    },
    [uid, load]
  );

  const renderMsg = (p: TalkPost, isReply: boolean) => {
    const app = p.author_app ? TALK_APPS[p.author_app] : null;
    const name = authorName(p);
    const initial = (name[0] || "?").toUpperCase();
    const color = app ? app.color : avatarColor(p.author?.username || p.author_id || name);
    const n = likes[p.id] ?? 0;
    const mine = uid !== null && p.author_id === uid;
    const chipHref =
      p.addr_type === "director"
        ? `/director/${p.addr_key}`
        : p.addr_type === "score"
          ? `/takescore/film/${p.film_key ?? p.addr_key}`
          : p.addr_type === "figure"
            ? `/film/${p.film_key ?? p.addr_key}`
            : `/film/${p.addr_key}`;
    const chip =
      p.addr_type !== addrType || p.addr_key !== addrKey ? (
        <Link className={`tk-chip ${p.addr_type}`} href={chipHref}>
          {p.addr_type === "figure" ? "◈ " : ""}
          {p.addr_key.replace(/-/g, " ").toUpperCase()}
        </Link>
      ) : null;
    return (
      <div key={p.id} className={`tk-msg${isReply ? " tk-reply" : ""}`}>
        <span className={`tk-av${app ? " app" : ""}`} style={{ background: color }} aria-hidden="true">
          {initial}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tk-mhead">
            {p.author?.username && !app ? (
              <Link className="tk-name" href={`/u/${p.author.username}`} style={{ textDecoration: "none", color: "inherit" }}>
                {name}
              </Link>
            ) : (
              <span className="tk-name">{name}</span>
            )}
            {app ? <span className="tk-badge">APP</span> : null}
            {chip}
            <span className="tk-time">{timeAgo(p.created_at)}</span>
          </div>
          <p className="tk-body">{p.body}</p>
          <div className="tk-row">
            <button
              type="button"
              className={`tk-pill heart${myLikes.has(p.id) ? " on" : ""}`}
              onClick={() => toggleLike(p.id)}
              aria-pressed={myLikes.has(p.id)}
            >
              {myLikes.has(p.id) ? "♥" : "♡"} {n > 0 ? n : ""}
            </button>
            {!isReply ? (
              <button type="button" className="tk-act" onClick={() => setReplyTo(replyTo === p.id ? null : p.id)}>
                Reply
              </button>
            ) : null}
            {mine ? (
              <button type="button" className="tk-act" onClick={() => softDelete(p.id)}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const count = posts.length;

  return (
    <section className="tk" id="talk" aria-label={`Talk on ${title}`}>
      <div className="tk-head">
        <h2>Talk</h2>
        {count > 0 ? <span className="tk-count">{count}</span> : null}
      </div>
      <p className="tk-sub">
        {addrType === "film"
          ? `Every note about ${title} — its figures, its score, any page — gathers here.`
          : `Notes about ${title} and the films they made.`}
      </p>

      {seed ? (
        <div className="tk-seed">
          <div className="tk-seed-eyebrow">METATAKE ASKS</div>
          <p>
            <Link href={`/film/${addrKey}/q/${seed.slug}`}>{seed.title}</Link>
          </p>
          <div className="tk-seed-note">A question from the site — answer it below, or open the full page.</div>
        </div>
      ) : null}

      {count > 1 ? (
        <div className="tk-tabs">
          <button type="button" className={`tk-tab${tab === "top" ? " on" : ""}`} onClick={() => setTab("top")}>
            Top
          </button>
          <button type="button" className={`tk-tab${tab === "new" ? " on" : ""}`} onClick={() => setTab("new")}>
            Newest
          </button>
        </div>
      ) : null}

      {ready && count === 0 ? (
        <p className="tk-empty">Seen it? Say what the reading missed — the first note opens the room.</p>
      ) : null}

      {roots.map((p) => (
        <div key={p.id}>
          {renderMsg(p, false)}
          {repliesOf(p.id).map((r) => renderMsg(r, true))}
          {replyTo === p.id ? (
            <div className="tk-replybox">
              <textarea
                className="tk-input"
                style={{ minHeight: 54 }}
                value={replyText}
                maxLength={2000}
                placeholder={`Reply to ${authorName(p)}…`}
                onChange={(e) => setReplyText(e.target.value)}
                onFocus={() => {
                  if (!uid) requireAuthEvent({ ctx: { kind: "save", verb: "save" } });
                }}
              />
              <div className="tk-compose-row">
                <button type="button" className="tk-post-btn" disabled={busy || !replyText.trim()} onClick={() => submit(p.id)}>
                  Reply
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      <div className="tk-compose">
        <textarea
          className="tk-input"
          value={text}
          maxLength={2000}
          placeholder={starterFor(addrKey)}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (!uid) requireAuthEvent({ ctx: { kind: "save", verb: "save" } });
          }}
        />
        <div className="tk-compose-row">
          <button type="button" className="tk-post-btn" disabled={busy || !text.trim()} onClick={() => submit(null)}>
            Post to {title} Talk
          </button>
          <span className="tk-note">Sign in with one tap to post · notes with links are held for review.</span>
        </div>
        {notice ? <div className="tk-notice">{notice}</div> : null}
        {error ? <div className="tk-error">{error}</div> : null}
      </div>
    </section>
  );
}
