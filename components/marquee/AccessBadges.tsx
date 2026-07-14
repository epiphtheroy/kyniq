"use client";

/**
 * AccessBadges — "how can I watch this" chips for one Marquee card. Fed the raw
 * availability rows from film_availability() and classified into at most three
 * chips, cheapest-first: 🟢 Subscription → 🔵 Free → 🟡 Rent. Each chip names the
 * tier explicitly (the owner asked for "Free"/"Subscription" to be labelled) plus
 * the provider; VPN mode adds the catalogue's country flag.
 */
import { isLibraryProvider } from "@/lib/wtw_library";

const LOGO = "https://image.tmdb.org/t/p/w45";

export type AvailRow = { kind: string; pid: number; name: string; logo: string | null; cc: string };

const flag = (cc: string) =>
  cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "";

type Tier = "sub" | "free" | "rent";
const TIER_LABEL: Record<Tier, string> = { sub: "Subscription", free: "Free", rent: "Rent" };

function tierOf(r: AvailRow): Tier {
  if (r.kind === "flatrate") return "sub";
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

  const pick = (tier: Tier): AvailRow | null => {
    const cand = rows.filter((r) => tierOf(r) === tier);
    if (cand.length === 0) return null;
    return cand.find((r) => mine.has(r.pid)) || cand.find((r) => isLibraryProvider(r.pid)) || cand[0];
  };

  const chips: { tier: Tier; r: AvailRow }[] = [];
  const s = pick("sub");
  if (s) chips.push({ tier: "sub", r: s });
  const f = pick("free");
  if (f) chips.push({ tier: "free", r: f });
  const rt = pick("rent");
  if (rt) chips.push({ tier: "rent", r: rt });
  if (chips.length === 0) return null;

  return (
    <span className="mq-badges">
      {chips.map(({ tier, r }) => {
        const lib = isLibraryProvider(r.pid);
        return (
          <span key={`${tier}-${r.pid}-${r.cc}`} className={`mq-badge mq-badge--${tier}`}
            title={`${TIER_LABEL[tier]} · ${r.name}${lib ? " (library card)" : ""}${showFlags ? ` · ${r.cc}` : ""}`}>
            <span className="mq-badge-tier">{TIER_LABEL[tier]}</span>
            {r.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${LOGO}${r.logo}`} alt={tier === "rent" ? r.name : ""} width={15} height={15} loading="lazy" />
            ) : null}
            <span className="mq-badge-txt">{tier === "rent" ? "" : r.name}{lib ? " · library" : ""}</span>
            {showFlags ? <span className="mq-badge-flag" aria-hidden>{flag(r.cc)}</span> : null}
          </span>
        );
      })}
    </span>
  );
}
