"use client";

// PlaylistTVEmbed — drops a METATAKE TV watch list into an axis page (a director,
// lineage, movement, genre, trope, or concept page). Fetches the playlist from
// the cached watch API; renders a compact 16:9 player + a link to the full
// /tv/list/[slug] page. Self-hides (renders nothing) when no playlist exists for
// this slug, so it is safe to place on every page unconditionally.
import { useEffect, useState } from "react";
import TVProgramPlayer, { type TVEntry } from "@/components/TVProgramPlayer";

export default function PlaylistTVEmbed({ slug, heading }: { slug: string; heading?: string }) {
  const [entries, setEntries] = useState<TVEntry[] | null>(null); // null = loading
  const [plTitle, setPlTitle] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let on = true;
    fetch(`/api/tv/watch?list=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (on) { setEntries(j.entries ?? []); setPlTitle(j.playlist?.title ?? null); } })
      .catch(() => { if (on) setEntries([]); });
    return () => { on = false; };
  }, [slug]);

  if (entries && entries.length === 0) return null; // no playlist for this slug

  // SEO: the heading must NAME the subject. Callers pass an entity-specific
  // heading (server-rendered into the HTML); the fetched playlist title (itself
  // entity-specific, e.g. "Palme d'Or — All the Broadcasts") is the fallback.
  return (
    <section className="df-sec pltv" id="df-tv">
      <h2 className="df-h2">{heading ?? plTitle ?? " "}</h2>
      <p className="pltv-tag">A single broadcast per film, compiled from the Metatake record — no LLM. It opens with a briefing, then plays each film.</p>
      <div className="df-tvhero pltv-box">
        {entries === null
          ? <div className="pltv-skel">Tuning in…</div>
          : <TVProgramPlayer entries={entries} entryIdx={idx} onEntryEnd={() => setIdx((i) => (entries.length ? (i + 1) % entries.length : 0))} />}
      </div>
      <a className="pltv-more" href={`/tv/list/${slug}`}>Open the full watch list ↗</a>
    </section>
  );
}
