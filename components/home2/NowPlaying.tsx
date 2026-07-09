"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Piece = {
  slug: string;
  headline: string;
  dek: string | null;
  keyword: string | null;
  anchor_label: string;
  published_at: string;
};

const RED = "#E3120B";

const stampOf = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date} · ${time} UTC`;
};

/**
 * Now Playing — the live layer, front and center on the home page
 * (hourly/README.md v2: "featured big on the main page"). Fetches its own
 * rows like BlogGraph so the server bundle RPC stays untouched. Renders
 * nothing until the first piece exists.
 */
type Digest = { digest_date: string; headline: string };

export default function NowPlaying() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);

  useEffect(() => {
    (async () => {
      const [p, d] = await Promise.all([
        sb.from("now_articles")
          .select("slug, headline, dek, keyword, anchor_label, published_at")
          .eq("status", "published").order("published_at", { ascending: false }).limit(4),
        sb.from("now_digests").select("digest_date, headline").order("digest_date", { ascending: false }).limit(1),
      ]);
      setPieces((p.data as Piece[] | null) ?? []);
      setDigest(((d.data as Digest[] | null) ?? [])[0] ?? null);
    })();
  }, []);

  if (!pieces || pieces.length === 0) return null;
  const [lead, ...rest] = pieces;

  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: RED,
                  marginRight: 10,
                  animation: "nowhome 2s ease-in-out infinite",
                }}
              />
              Now Playing <span className="chev">›</span>
            </h2>
            <div className="sub">The live layer — what&apos;s spiking right now, read through the archive.</div>
          </div>
          <Link className="seeall" href="/now">All pieces ›</Link>
        </div>

        <style>{`@keyframes nowhome { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>

        <Link
          href={`/now/${lead.slug}`}
          style={{ display: "block", textDecoration: "none", color: "inherit", borderTop: `3px solid ${RED}`, paddingTop: 18 }}
        >
          <div style={{ font: "700 11px/1 Inter,sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", color: RED }}>
            {stampOf(lead.published_at)}
            {lead.keyword ? <span style={{ color: "#6b6b6b", textTransform: "none", letterSpacing: 0 }}>{"  ·  the world is searching “" + lead.keyword + "”"}</span> : null}
          </div>
          <div style={{ font: '700 clamp(26px,3.6vw,44px)/1.15 "PT Serif",Georgia,serif', margin: "10px 0 8px" }}>
            {lead.headline}
          </div>
          {lead.dek ? (
            <div style={{ font: '400 17px/1.55 "PT Serif",Georgia,serif', color: "#444", maxWidth: 820 }}>{lead.dek}</div>
          ) : null}
          <div style={{ font: "500 12.5px/1.6 Inter,sans-serif", color: "#6b6b6b", marginTop: 10 }}>
            Anchor: {lead.anchor_label} · every data point live in the corpus
          </div>
        </Link>

        {rest.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 22,
              marginTop: 24,
              borderTop: "1px solid #d8d8d8",
              paddingTop: 18,
            }}
          >
            {rest.map((p) => (
              <Link key={p.slug} href={`/now/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ font: "600 11px/1 Inter,sans-serif", letterSpacing: "0.08em", color: "#6b6b6b" }}>
                  {stampOf(p.published_at)}
                </div>
                <div style={{ font: '700 18px/1.3 "PT Serif",Georgia,serif', margin: "7px 0 5px" }}>{p.headline}</div>
                <div style={{ font: "500 12px/1.5 Inter,sans-serif", color: "#6b6b6b" }}>{p.anchor_label}</div>
              </Link>
            ))}
          </div>
        ) : null}

        {digest ? (
          <Link
            href={`/now/daily/${digest.digest_date}`}
            style={{
              display: "block", marginTop: 20, paddingTop: 16, borderTop: "1px solid #d8d8d8",
              textDecoration: "none", color: "inherit",
            }}
          >
            <span style={{ font: "700 11px/1 Inter,sans-serif", letterSpacing: "0.1em", textTransform: "uppercase", color: RED }}>
              The daily digest · {digest.digest_date}
            </span>
            <span style={{ display: "block", font: '700 17px/1.3 "PT Serif",Georgia,serif', marginTop: 5, color: "#1a1714" }}>
              {digest.headline}
            </span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
