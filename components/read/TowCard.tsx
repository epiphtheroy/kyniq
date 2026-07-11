import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import "./tow-card.css";

// to.W — the curator's letter, addressed "to. W. Heo" and signed "from. W. Yoon".
// A single-film note on where a film stands in the Metatake index, assembled
// (LLM-0) from curation.v_film_comment via the tow_comment RPC. Shared across
// the TakeScore film page and the film page's TakeScore section.

export type TowComment = {
  verdict: string;
  verdict_label: string | null;
  authority_label: string | null;
  rationale: string | null;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Null is a real state (curation-less films render nothing), so a cached null is
// fine; only transport errors throw (and are thus never cached).
export function loadTow(slug: string): Promise<TowComment | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await db().rpc("tow_comment", { p_slug: slug });
      if (error) throw new Error(`tow_comment(${slug}): ${error.message}`);
      return (data as TowComment | null) ?? null;
    },
    ["tow-comment1", slug],
    { revalidate: 3600, tags: [`takescore-film:${slug}`] },
  )().catch(() => null);
}

export default function TowCard({ tow, filmTitle }: { tow: TowComment | null; filmTitle: string }) {
  if (!tow?.rationale) return null;
  return (
    <section className="towc" aria-labelledby="towc-h">
      <div className="towc-head">
        <div>
          <div className="towc-kicker">to. W. Heo</div>
          <h2 className="towc-h" id="towc-h">Why it&apos;s in the index</h2>
        </div>
        {tow.verdict_label ? (
          <span className={`towc-chip towc-chip--${tow.verdict}`}>{tow.verdict_label}</span>
        ) : null}
      </div>
      <p className="towc-p">{tow.rationale}</p>
      <div className="towc-signrow">
        <span className="towc-sign">from. W. Yoon</span>
        <Link href="/editor" className="towc-ava" title="Wonwoo Yoon — Metatake editor" aria-label="Wonwoo Yoon, Metatake editor — view profile">w</Link>
      </div>
      <p className="towc-note">
        A curator&apos;s note on {filmTitle}&apos;s place in the Metatake index — drawn from the catalog&apos;s
        curation records, and kept separate from the TakeScore appraisal above.
      </p>
    </section>
  );
}
