/**
 * NavigatorShell — the two-pane web layout (P5, Google-Maps desktop shape).
 *   LEFT rail  = the destination list (all completable journeys + coverage).
 *   RIGHT stage = the live drive map (current turn, next film, remaining films).
 * Server component: it renders both panes every request, so choosing a
 * destination on the left is a plain link (?dir=/?lineage=/?decade=/?sub=) that
 * re-renders the stage while the rail stays put — no client fetching.
 *
 * Responsive (navigator.css): desktop shows both columns; on a phone the shell
 * collapses to one — the rail when no destination is chosen (data-mode="pick"),
 * the map when one is (data-mode="drive"), with a "← Destinations" back link.
 */
import Link from "next/link";
import NavigatorDrive from "./NavigatorDrive";
import NavigatorPicker, { type PickDest, type CatalogEntry } from "./NavigatorPicker";
import type { DriveLoad } from "@/lib/navigator/load";
import type { RoutePref } from "@/lib/navigator/route";

export interface RailProps {
  directors: PickDest[];
  canon: PickDest[];
  decades: PickDest[];
  sub: PickDest | null;
  /** full lineage catalog for the "All lists" browse-all (picker view only) */
  catalog: CatalogEntry[];
}

export default function NavigatorShell({
  rail, drive, pref, activeKey, notFound = false, resume = null,
}: {
  rail: RailProps;
  drive: DriveLoad | null;
  pref: RoutePref;
  activeKey?: string;
  /** a destination was requested but no route could be built */
  notFound?: boolean;
  /** the member's active drive → a "Resume" card atop the rail */
  resume?: { label: string; href: string; kind: string } | null;
}) {
  return (
    <div className="nav-shell" data-mode={drive || notFound ? "drive" : "pick"}>
      <aside className="nav-rail">
        <NavigatorPicker
          directors={rail.directors}
          canon={rail.canon}
          decades={rail.decades}
          sub={rail.sub}
          catalog={rail.catalog}
          activeKey={activeKey}
          resume={resume}
        />
      </aside>
      <div className="nav-stage">
        {drive ? (
          <>
            <Link href="/room/navigator" className="nav-back">← Destinations</Link>
            <NavigatorDrive load={drive} pref={pref} />
          </>
        ) : notFound ? (
          <div className="nav-empty">
            <Link href="/room/navigator" className="nav-back">← Destinations</Link>
            <div className="ne-badge">🚧</div>
            <div className="ne-h">Couldn&apos;t build a route</div>
            <div className="ne-p">There aren&apos;t enough films for this destination yet. Pick another from the list.</div>
          </div>
        ) : (
          <div className="nav-empty">
            <div className="ne-badge">🧭</div>
            <div className="ne-h">Pick a destination</div>
            <div className="ne-p">
              Choose a journey on the left. Your unwatched films become the route,
              and the Navigator guides your next film — turn by turn.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
