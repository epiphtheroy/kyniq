"use client";

/**
 * ConnectionDesk — the connection-map two-column desk: EntityMap (graph) on the
 * left, SentenceLexicon (atlas-style rotating sentence rail) on the right.
 * Recentering the graph re-roots the lexicon on the same entity; clicking names
 * inside the lexicon navigates the text-world independently.
 */

import { useState } from "react";
import EntityMap, { type CenterEnt } from "@/components/EntityMap";
import SentenceLexicon, { type LexEnt } from "@/components/SentenceLexicon";

export default function ConnectionDesk({ api, full, root, height = 460 }: {
  api: string; full: string; root: LexEnt; height?: number;
}) {
  const [follow, setFollow] = useState<CenterEnt | null>(null);
  const cur = follow ?? root;
  return (
    <div className="cmap-cols">
      <div className="cmap-colgraph">
        <EntityMap api={api} full={full} height={height} onCenter={setFollow} />
      </div>
      <SentenceLexicon key={`${cur.type}:${cur.key}:${cur.key2 ?? ""}`} root={cur} height={height} />
    </div>
  );
}
