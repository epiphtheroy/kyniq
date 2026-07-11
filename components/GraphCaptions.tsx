"use client";

/**
 * GraphCaptions — a "why these are connected" strip under a connection graph.
 * Client-fetches the top pair-sentences for one film from /api/sentences/for and
 * renders them one-per-line with a link to the connected film. Turns the graph
 * from a picture into something that explains itself. Renders nothing if empty.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { filmUrl } from "@/lib/urls";

type Row = {
  id: number;
  pattern: string;
  sentence: string;
  other: { slug: string; title: string; year: number | null } | null;
};

export default function GraphCaptions({ slug }: { slug: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    setRows([]);
    fetch(`/api/sentences/for?slug=${encodeURIComponent(slug)}&limit=3&patterns=A_affinity,B_bridge,H_dense,G_theorist_twin`)
      .then((r) => r.json())
      .then((j) => { if (alive) setRows(Array.isArray(j.rows) ? j.rows : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  if (!rows.length) return null;
  return (
    <div className="gcap">
      <div className="gcap-h">Why these are connected</div>
      <ul className="gcap-list">
        {rows.map((r) => (
          <li key={r.id} className="gcap-row">
            <span className="gcap-txt">{r.sentence}</span>
            {r.other ? (
              <Link className="gcap-lk" href={filmUrl(r.other.slug)}>{r.other.title} →</Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
