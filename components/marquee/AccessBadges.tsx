"use client";

/**
 * AccessBadges — the "how can I watch this" chips for one Marquee row. Fed the raw
 * availability rows from film_availability() and classified here into at most three
 * chips, cheapest-first: 🟢 Streaming (a service you pay for) → 🔵 Free (free / ad
 * / library) → 🟡 Rent. When VPN is on, each chip carries the catalogue's country
 * flag. Badge-only: renting never entered the ranking (see 0094 / handoff §4-4).
 */
import { isLibraryProvider } from "@/lib/wtw_library";

const LOGO = "https://image.tmdb.org/t/p/w45";

export type AvailRow = { kind: string; pid: number; name: string; logo: string | null; cc: string };

const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

type Tier = "stream" | "free" | "rent";
function tierOf(r: AvailRow): Tier {
  if (r.kind === "flatrate") return "stream";
  if (r.kind === "rent" || r.kind === "buy") return "rent";
  return "free"; // free, ads, library
}

export default function AccessBadges({
  rows, providers, showFlags,
}: {
  rows: AvailRow[] | undefined;
  providers: number[];
  showFlags: boolean;
}) {
  if (!rows || rows.length === 0) return null;
  const mine = new Set(providers);

  // Pick the single best representative per tier (prefer one on a service you own,
  // then a library card, then anything), so the row shows ≤3 clean chips.
  const pick = (tier: Tier): AvailRow | null => {
    const cand = rows.filter((r) => tierOf(r) === tier);
    if (cand.length === 0) return null;
    return (
      cand.find((r) => mine.has(r.pid)) ||
      cand.find((r) => isLibraryProvider(r.pid)) ||
      cand[0]
    );
  };

  const chips: { tier: Tier; r: AvailRow; label: string }[] = [];
  const s = pick("stream");
  if (s) chips.push({ tier: "stream", r: s, label: s.name });
  const f = pick("free");
  if (f) chips.push({ tier: "free", r: f, label: isLibraryProvider(f.pid) ? `${f.name} · library` : f.name });
  const rt = pick("rent");
  if (rt) chips.push({ tier: "rent", r: rt, label: "Rent" });

  if (chips.length === 0) return null;

  return (
    <span className="mq-badges">
      {chips.map(({ tier, r, label }) => (
        <span key={`${tier}-${r.pid}-${r.cc}`} className={`mq-badge mq-badge--${tier}`} title={`${label}${showFlags ? ` · ${r.cc}` : ""}`}>
          {r.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${LOGO}${r.logo}`} alt="" width={16} height={16} loading="lazy" />
          ) : null}
          <span className="mq-badge-txt">{label}</span>
          {showFlags ? <span className="mq-badge-flag" aria-hidden>{flag(r.cc)}</span> : null}
        </span>
      ))}
    </span>
  );
}
