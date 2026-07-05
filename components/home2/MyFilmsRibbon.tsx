"use client";

/**
 * MyFilmsRibbon — slim home band introducing the My Films lens (nav toggle).
 * Personalises once the lens is ready: shows the live mode + seen count for
 * signed-in users, a try-it pitch for everyone else. Pure client overlay —
 * the server-rendered home stays byte-identical for every visitor.
 */
import Link from "next/link";
import { useLens } from "@/components/LensProvider";

export default function MyFilmsRibbon() {
  const lens = useLens();
  const hasLens = !!lens?.uid && (lens?.seenCount ?? 0) > 0;

  return (
    <div className="mflband">
      <div className="wrap mflrow">
        <span className="mflnew">New</span>
        <p className="mflp">
          <b>My Films</b>{" — flip the whole site to the films you’ve seen: a red border on every poster you know, or the galaxy, atlas and lists re-centred on your own history."}
          {hasLens ? (
            <span className="mflme">
              {" "}Your lens covers <b>{lens!.seenCount.toLocaleString()}</b> films
              {lens!.active ? <> · <b>{lens!.mode === "only" ? "Only mine" : "Highlight mine"}</b> is on</> : null}.
            </span>
          ) : null}
        </p>
        <Link className="mflcta" href="/my-films">
          {hasLens ? "Manage the lens →" : "Try the lens →"}
        </Link>
      </div>
    </div>
  );
}
