"use client";
/**
 * NavigatorPicker — the destination list. On desktop it is the persistent LEFT
 * rail of the two-pane shell (map on the right); on mobile it is the full-page
 * "Where to?" screen. Lists the journeys the viewer can complete: in-progress
 * director conquests + canon/list lineages (each with a progress ring), plus two
 * computed families — decade TakeScore essentials and the my-subscription list —
 * linking into the drive (?dir= / ?lineage= / ?decade= / ?sub=). Assembled from
 * me_auteur_conquest + me_coverage + the ledger's own seen∩decade counts (decade/
 * sub coverage is only known once the drive loads, so those cards carry a seen
 * hint instead of a ring). `activeKey` marks the destination currently driving.
 */
import Link from "next/link";

export type PickDest = {
  kind: "dir" | "lineage" | "decade" | "sub";
  key: string;
  label: string;
  facet?: string;
  seen: number;
  total: number;   // 0 → no progress ring (decade/sub: coverage unknown until the drive loads)
  pct: number;
};

const FACET_EN: Record<string, string> = {
  canon: "Canon", critics: "Critics' picks", festival: "Festival", award: "Awards", national: "National canon", other: "List",
};

/** The stable identity of a destination card — matches `activeKey` from the page. */
export function destKey(d: PickDest): string {
  return `${d.kind}:${d.key}`;
}

function hrefOf(d: PickDest): string {
  const label = `&label=${encodeURIComponent(d.label)}`;
  switch (d.kind) {
    case "dir": return `/room/navigator?dir=${encodeURIComponent(d.key)}`;
    case "lineage": return `/room/navigator?lineage=${encodeURIComponent(d.key)}${label}`;
    case "decade": return `/room/navigator?decade=${encodeURIComponent(d.key)}${label}`;
    case "sub": return `/room/navigator?sub=1${label}`;
  }
}

function metaOf(d: PickDest): string {
  switch (d.kind) {
    case "dir": return `Director · ${d.seen}/${d.total} watched · ${d.total - d.seen} to go`;
    case "lineage": return `${FACET_EN[d.facet ?? "other"] ?? d.facet ?? "List"} · ${d.seen}/${d.total} watched · ${d.total - d.seen} to go`;
    case "decade": return d.seen > 0 ? `Top TakeScore by year · ${d.seen} already logged` : "Top TakeScore by year";
    case "sub": return "Best on your services · before they leave";
  }
}

function card(d: PickDest, activeKey?: string) {
  const ring = d.total > 0;
  const on = activeKey === destKey(d);
  return (
    <Link key={destKey(d)} className={`np-card${on ? " on" : ""}`} href={hrefOf(d)} aria-current={on ? "page" : undefined}>
      {ring ? (
        <span className="np-ring" style={{ ["--p" as string]: `${Math.min(360, d.pct * 3.6)}deg` }}><span>{d.pct}%</span></span>
      ) : null}
      <span className="np-l">
        <span className="np-n">{d.label}</span>
        <span className="np-m">{metaOf(d)}</span>
      </span>
      <span className="np-go">{on ? "Driving" : "Drive →"}</span>
    </Link>
  );
}

export default function NavigatorPicker({
  directors, canon, decades = [], sub = null, activeKey,
}: {
  directors: PickDest[];
  canon: PickDest[];
  decades?: PickDest[];
  sub?: PickDest | null;
  activeKey?: string;
}) {
  const empty = directors.length === 0 && canon.length === 0;
  return (
    <div className="navd np">
      <div className="np-head">
        <div className="np-k">The Navigator</div>
        <h1 className="np-h">Where to?</h1>
        <p className="np-p">Pick a destination and your unwatched films become the route — the Navigator guides your next film, turn by turn.</p>
      </div>
      <div className="np-body">
        {empty ? (
          <div className="np-emptycard">
            No journeys in progress yet. <Link href="/room/ledger" className="np-lnk">Log</Link> a few films or{" "}
            <Link href="/me/import" className="np-lnk">import</Link> your history, and canon &amp; director destinations appear here.{" "}
            <Link href="/room/navigator?dir=stanley-kubrick" className="np-lnk">Try Kubrick →</Link>
          </div>
        ) : null}
        {directors.length ? (
          <>
            <div className="np-sect">Director conquests — pick up where you left off</div>
            {directors.map((d) => card(d, activeKey))}
          </>
        ) : null}
        {canon.length ? (
          <>
            <div className="np-sect">Canon &amp; lists</div>
            {canon.map((d) => card(d, activeKey))}
          </>
        ) : null}
        {decades.length ? (
          <>
            <div className="np-sect">By decade</div>
            {decades.map((d) => card(d, activeKey))}
          </>
        ) : null}
        {sub ? (
          <>
            <div className="np-sect">Your subscriptions</div>
            {card(sub, activeKey)}
          </>
        ) : null}
      </div>
    </div>
  );
}
