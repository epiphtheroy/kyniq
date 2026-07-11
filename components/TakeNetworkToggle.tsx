"use client";

/**
 * TakeNetworkToggle — a small "map" affordance under a reading card that lazily mounts
 * the take → meta-take → kindred-takes mini-graph (NodeGraph kind="take", bare).
 * Lazy so a figure with many readings doesn't run N simulations at once.
 */

import { useState } from "react";
import NodeGraph from "@/components/NodeGraph";

export default function TakeNetworkToggle({
  mtSlug, mtTitle, label, takeId,
}: {
  mtSlug: string; mtTitle: string; label: string; takeId: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="fig-take__map">
      <button type="button" className="fig-take__maptoggle" onClick={() => setShow((s) => !s)}>
        {show ? "▾ hide map" : "▸ map"}
      </button>
      {show ? (
        <NodeGraph kind="take" bare mtSlug={mtSlug} mtTitle={mtTitle} label={label} excludeTakeId={takeId} />
      ) : null}
    </div>
  );
}
