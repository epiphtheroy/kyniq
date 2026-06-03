"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

interface Contribution {
  id: string;
  body: string;
  upvotes: number;
  sort_score: number;
  merged_into_canonical: boolean;
  created_at: string;
  source: string;
  author: { username: string; display_name: string } | null;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author: { username: string; display_name: string } | null;
}

export default function ContributionSection({
  questionId,
  filmSlug,
}: {
  questionId: string;
  filmSlug: string;
}) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [tab, setTab] = useState<"top" | "newest">("top");
  const [userId, setUserId] = useState<string | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [newReading, setNewReading] = useState("");
  const [posting, setPosting] = useState(false);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  const fetchContributions = useCallback(async () => {
    const supabase = getSupabase();
    const order = tab === "top" ? "sort_score" : "created_at";
    const { data } = await supabase
      .from("contributions")
      .select("id, body, upvotes, sort_score, merged_into_canonical, created_at, source, author:profiles!contributions_author_id_fkey(username, display_name)")
      .eq("question_id", questionId)
      .eq("status", "published")
      .order(order, { ascending: false });

    setContributions((data as unknown as Contribution[]) ?? []);
  }, [questionId, tab]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  useEffect(() => {
    async function checkUser() {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Get user's votes for these contributions
        const { data: votes } = await supabase
          .from("votes")
          .select("contribution_id")
          .eq("user_id", user.id);
        if (votes) {
          setVotedIds(new Set(votes.map((v) => v.contribution_id)));
        }
      }
    }
    checkUser();
  }, []);

  async function toggleVote(contributionId: string) {
    if (!userId) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    const supabase = getSupabase();
    const hasVoted = votedIds.has(contributionId);

    if (hasVoted) {
      await supabase.from("votes").delete().eq("user_id", userId).eq("contribution_id", contributionId);
      // Decrement upvotes
      await supabase.rpc("decrement_upvotes", { cid: contributionId }).catch(() => {
        // Fallback: just update directly
        const c = contributions.find((x) => x.id === contributionId);
        if (c) {
          supabase.from("contributions").update({ upvotes: Math.max(0, c.upvotes - 1) }).eq("id", contributionId);
        }
      });
      setVotedIds((prev) => { const s = new Set(prev); s.delete(contributionId); return s; });
    } else {
      await supabase.from("votes").insert({ user_id: userId, contribution_id: contributionId });
      // Increment upvotes
      await supabase.rpc("increment_upvotes", { cid: contributionId }).catch(() => {
        const c = contributions.find((x) => x.id === contributionId);
        if (c) {
          supabase.from("contributions").update({ upvotes: c.upvotes + 1 }).eq("id", contributionId);
        }
      });
      setVotedIds((prev) => new Set(prev).add(contributionId));
    }

    fetchContributions();
  }

  async function postReading() {
    if (!userId || !newReading.trim()) return;
    setPosting(true);

    const supabase = getSupabase();
    await supabase.from("contributions").insert({
      question_id: questionId,
      author_id: userId,
      body: newReading.trim(),
      status: "published",
      source: "human",
      published_at: new Date().toISOString(),
    });

    setNewReading("");
    setPosting(false);
    fetchContributions();
  }

  async function loadComments(contributionId: string) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("comments")
      .select("id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name)")
      .eq("contribution_id", contributionId)
      .order("created_at");

    setComments((prev) => ({ ...prev, [contributionId]: (data as unknown as Comment[]) ?? [] }));
    setShowComments((prev) => ({ ...prev, [contributionId]: true }));
  }

  async function postComment(contributionId: string) {
    if (!userId || !newComment[contributionId]?.trim()) return;

    const supabase = getSupabase();
    await supabase.from("comments").insert({
      contribution_id: contributionId,
      author_id: userId,
      body: newComment[contributionId].trim(),
    });

    setNewComment((prev) => ({ ...prev, [contributionId]: "" }));
    loadComments(contributionId);
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  };

  const initials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div>
      {/* Section header + tabs */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div className="seclbl">Readings from the community</div>
        <div className="ui" style={{ fontSize: 12.5 }}>
          <button
            onClick={() => setTab("top")}
            className={`tab ${tab === "top" ? "active" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 2px" }}
          >
            Top
          </button>
          {" · "}
          <button
            onClick={() => setTab("newest")}
            className={`tab ${tab === "newest" ? "active" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 2px" }}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Contributions list */}
      {contributions.map((c) => (
        <div key={c.id} style={{ marginTop: 18, display: "flex", gap: 13 }}>
          <div className="avatar ui" style={{ width: 30, height: 30, fontSize: 11, background: "var(--bg)" }}>
            {c.author ? initials(c.author.username) : "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span className="ui" style={{ fontSize: 13.5 }}>
                {c.author?.username || "anonymous"}
              </span>
              <span className="ui muted" style={{ fontSize: 11.5 }}>{timeAgo(c.created_at)}</span>
            </div>

            <p className="body reading" style={{ fontSize: 17, lineHeight: 1.6, margin: "7px 0 0" }}>
              {c.body}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 9 }}>
              <button
                onClick={() => toggleVote(c.id)}
                className={`upvote ${votedIds.has(c.id) ? "active" : ""}`}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                ▲ {c.upvotes}
              </button>

              {c.merged_into_canonical && (
                <span className="merged">merged into the canonical answer</span>
              )}

              <button
                onClick={() => showComments[c.id] ? setShowComments((p) => ({ ...p, [c.id]: false })) : loadComments(c.id)}
                className="action-secondary"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                reply
              </button>
            </div>

            {/* Comments */}
            {showComments[c.id] && (
              <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: "1px solid var(--hairline)" }}>
                {(comments[c.id] ?? []).map((cm) => (
                  <div key={cm.id} style={{ marginBottom: 10 }}>
                    <span className="ui" style={{ fontSize: 12.5 }}>{cm.author?.username || "anon"}</span>
                    <span className="ui muted" style={{ fontSize: 11.5, marginLeft: 6 }}>{timeAgo(cm.created_at)}</span>
                    <p className="body" style={{ fontSize: 15, margin: "3px 0 0", lineHeight: 1.5 }}>{cm.body}</p>
                  </div>
                ))}
                {userId && (
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input
                      type="text"
                      value={newComment[c.id] || ""}
                      onChange={(e) => setNewComment((p) => ({ ...p, [c.id]: e.target.value }))}
                      placeholder="Reply…"
                      className="field"
                      style={{ flex: 1, fontSize: 13, padding: "6px 10px" }}
                      onKeyDown={(e) => e.key === "Enter" && postComment(c.id)}
                    />
                    <button onClick={() => postComment(c.id)} className="btn" style={{ fontSize: 12, padding: "6px 12px" }}>
                      Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {contributions.length === 0 && (
        <p className="ui muted" style={{ marginTop: 18, fontSize: 14, fontStyle: "italic" }}>
          No community readings yet — be the first.
        </p>
      )}

      {/* Post new reading */}
      <div id="share-reading" style={{ marginTop: 30 }}>
        <hr className="rule" />
        <div className="seclbl">Share your reading</div>
        <div className="tick" />
        {userId ? (
          <div>
            <textarea
              value={newReading}
              onChange={(e) => setNewReading(e.target.value)}
              placeholder="How do you read this?"
              className="field"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", outline: "none", marginTop: 4 }}
            />
            <button
              onClick={postReading}
              disabled={posting || !newReading.trim()}
              className="btn"
              style={{ marginTop: 10, opacity: posting || !newReading.trim() ? 0.5 : 1 }}
            >
              {posting ? "Posting…" : "Post reading"}
            </button>
          </div>
        ) : (
          <p className="ui" style={{ fontSize: 14, marginTop: 8 }}>
            <a href={`/login?next=${encodeURIComponent(`/film/${filmSlug}/q/`)}`} className="accent" style={{ textDecoration: "none" }}>
              Sign in
            </a>
            {" "}to share your reading.
          </p>
        )}
      </div>
    </div>
  );
}
