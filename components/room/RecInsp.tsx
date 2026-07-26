"use client";
/** Shared inspector — the same three cards wherever a film is clicked:
 *  ① Why this film (server-sent reason chips with taxonomy deep links + one
 *    natural-language line — explainability invariant)
 *  ② Cinecodex card (ours / external / canon shown separately — the canonical
 *    never-blend surface)
 *  ③ Act now (Keep · Seen · Not interested + half stars; rating implies seen). */
import { useEffect, useState } from "react";
import Link from "next/link";
import { chipsOf, whySentence, REASON_MAP } from "@/lib/room/format";
import { STR } from "./strings";
import CinecodexCard from "./CinecodexCard";
import ICard from "./insp/ICard";
import SelHead from "./insp/SelHead";
import ActBar, { type Act } from "./insp/ActBar";
import Stars from "./Stars";

export type RecFilm = {
  slug: string; title: string;
  year?: number | null; director?: string | null; poster_path?: string | null;
  reasons?: string[] | null;
  v?: number | null; c?: number | null; r?: number | null; u?: number | null;
  prestige?: number | null; discovery?: number | null; conf?: number | null; tier?: string | null;
  rating?: number | null; kept?: boolean;
};

export default function RecInsp({ f, onKeep, onSeen, onDismiss, onRate }: {
  f: RecFilm;
  onKeep?: (f: RecFilm) => void;
  onSeen?: (f: RecFilm) => void;
  onDismiss?: (f: RecFilm) => void;
  onRate?: (f: RecFilm, v: number) => void;
}) {
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [localKept, setLocalKept] = useState(false);
  // React reuses the instance across consecutive select() calls without a key —
  // reset local state when the film changes.
  useEffect(() => { setLocalRating(null); setLocalKept(false); }, [f.slug]);

  const chips = chipsOf(f.reasons);
  const why = whySentence(f.reasons);

  const acts: Act[] = [];
  if (onKeep) acts.push({ label: (f.kept || localKept) ? `✓ ${STR.row.kept}` : STR.row.keep, primary: true, onClick: () => { setLocalKept(true); onKeep(f); } });
  if (onSeen) acts.push({ label: STR.row.seen, onClick: () => onSeen(f) });
  if (onDismiss) acts.push({ label: STR.row.dismiss, onClick: () => onDismiss(f) });

  return (
    <div>
      <SelHead title={f.title} sub={<>{f.year ?? "?"}{f.director ? ` · ${f.director}` : ""}</>} posterPath={f.poster_path} />

      <ICard icon="ti-bulb" title={STR.insp.why}>
        {chips.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {chips.map((c, i) => (
              c.href
                ? <Link key={i} className={`rsn ${c.cls}`} href={c.href}>{c.label}</Link>
                : <span key={i} className={`rsn ${c.cls}`}>{c.label}</span>
            ))}
          </div>
        ) : null}
        <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.6, color: "var(--ink)" }}>
          {why || STR.insp.whyEmpty}
        </div>
      </ICard>

      <CinecodexCard d={{
        v: f.v ?? null, c: f.c ?? null, r: f.r ?? null, u: f.u,
        prestige: f.prestige, discovery: f.discovery, conf: f.conf, tier: f.tier,
      }} slug={f.slug} />

      {(acts.length || onRate) ? (
        <ICard icon="ti-player-play" title={STR.insp.actNow}>
          {acts.length ? <ActBar acts={acts} style={{ marginBottom: onRate ? 10 : 0, marginTop: 0 }} /> : null}
          {onRate ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Stars value={localRating ?? f.rating ?? 0} onPick={(v) => { setLocalRating(v); onRate(f, v); }} title={STR.insp.myRating} />
              <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{STR.insp.ratingHint}</span>
            </div>
          ) : null}
        </ICard>
      ) : null}

      {/* continuity (마이룸-v4 §4.1): the sheet is the film's front door — the
          full pages are one tap away, and Esc/back returns right here. */}
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, fontWeight: 600 }}>
        <Link href={`/takescore/film/${f.slug}`} style={{ color: "var(--red)", textDecoration: "none" }}>
          Full TakeScore card →
        </Link>
        <Link href={`/film/${f.slug}`} style={{ color: "var(--mut)", textDecoration: "none" }}>
          Film page →
        </Link>
      </div>
    </div>
  );
}

/* Re-export so screen agents can build custom chip rows without re-importing format. */
export { REASON_MAP };
