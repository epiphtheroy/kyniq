import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadWwi } from "@/lib/room/loadCollection";
import { num, IMG185, type WwiRow } from "@/lib/room/format";
import CoverageWorkspace, {
  type CoverageData, type CovRow, type BlindRow,
} from "@/components/room/CoverageWorkspace";
import "./coverage.css";

export const dynamic = "force-dynamic";

/** /room/coverage — Coverage instrument (spec §3.7).
 *  Three parallel reads; a failed read passes null so the workspace renders the
 *  shared .errcard for that module instead of silently showing empty data.
 *  me_coverage/me_blindspots are RPC-capped (300/12 rows) — cap-safe by design.
 *  NOTE: the deployed me_blindspots signature is (p_limit, p_min_total,
 *  p_min_aw) per migration 0027 — the spec's `p_max_pct` name does not exist in
 *  the DB; 0.55 is the authority floor. */
export default async function RoomCoveragePage({ searchParams }: {
  searchParams: Promise<{ facet?: string }>;
}) {
  const { facet } = await searchParams;
  const supabase = await createClient();

  const [covRes, bsRes, wwi, auRes] = await Promise.all([
    supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 300 }),
    supabase.rpc("me_blindspots", { p_limit: 12, p_min_total: 10, p_min_aw: 0.55 }),
    loadWwi(1.0, 40).then((r): WwiRow[] | null => r, (): WwiRow[] | null => null),
    // 오너 요청(마이룸-v4 §4.1): 커버리지에서 감독별 커버리지도 함께 보이게.
    supabase.rpc("me_auteur_conquest", { p_limit: 8 }),
  ]);

  const data: CoverageData = {
    coverage: covRes.error ? null : ((covRes.data as CovRow[] | null) ?? []),
    blind: bsRes.error ? null : ((bsRes.data as BlindRow[] | null) ?? []),
    wwi,
  };
  const auteurs = auRes.error
    ? []
    : (((auRes.data as { slug: string; name: string | null; profile_path: string | null; seen: number | string | null; total: number | string | null; pct: number | string | null }[] | null) ?? [])
        .map((a) => ({ slug: a.slug, name: a.name ?? a.slug, profile_path: a.profile_path, seen: num(a.seen) ?? 0, total: num(a.total) ?? 0, pct: num(a.pct) ?? 0 })));

  return (
    <>
      <CoverageWorkspace data={data} initialFacet={facet} />
      {auteurs.length ? (
        <section className="room-v4" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px 32px" }}>
          <div className="dk-sechd" style={{ margin: "6px 0 10px" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Director conquest</h2>
            <span className="sub" style={{ fontSize: 12, color: "#8A857C" }}>감독별 커버리지</span>
            <Link className="go" href="/room/auteurs" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "var(--red)", textDecoration: "none" }}>
              All directors →
            </Link>
          </div>
          <div className="dk-auteurs" style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(80px, 1fr))", gap: 10 }}>
            {auteurs.map((a) => (
              <Link key={a.slug} className="dk-au" href="/room/auteurs" title={`${a.name} — ${a.seen}/${a.total} (${a.pct}%)`}>
                <span className="dk-aupo" style={a.profile_path ? { backgroundImage: `url(${IMG185}${a.profile_path})` } : {}} />
                <span className="dk-aunm">{a.name}</span>
                <span className="dk-aupct">{a.pct}% · {a.seen}/{a.total}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
