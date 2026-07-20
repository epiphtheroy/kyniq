import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * BoardCoverage — the personal coverage instruments brought over from My Room:
 * how much of the canon (정전) you've covered, and your auteur (director)
 * conquest. Server component; auth-gated. Data from me_coverage /
 * me_auteur_conquest (the same RPCs /room uses).
 */

export const dynamic = "force-dynamic";
const IMG = "https://image.tmdb.org/t/p";
const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

type CovRow = { list_id: string; slug: string; label: string; facet: string; aw: number; seen: number; total: number; pct: number; state: string };
type AutRow = { slug: string; name: string; profile_path: string | null; seen: number; total: number; pct: number; avg_rating: number | null };

export default async function BoardCoverage() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    user = auth?.user ?? null;
    if (!user) return <SignIn />;

    const [covRes, autRes] = await Promise.all([
      supabase.rpc("me_coverage", { p_min_total: 5, p_limit: 250 }),
      supabase.rpc("me_auteur_conquest", { p_limit: 30 }),
    ]);

    const canon: CovRow[] = ((covRes.data as CovRow[] | null) ?? [])
      .filter((c) => c.facet === "canon")
      .map((c) => ({ ...c, seen: num(c.seen), total: num(c.total), pct: num(c.pct), aw: num(c.aw) }))
      .sort((a, b) => b.aw - a.aw || b.pct - a.pct)
      .slice(0, 18);

    const auteurs: AutRow[] = ((autRes.data as AutRow[] | null) ?? [])
      .map((a) => ({ ...a, seen: num(a.seen), total: num(a.total), pct: num(a.pct) }))
      .filter((a) => a.total > 0)
      .sort((a, b) => b.seen - a.seen || b.pct - a.pct)
      .slice(0, 24);

    return (
      <section className="bcov" aria-label="My coverage">
        <div className="bcov-head">
          <div className="seclbl">My room · 나의 발자취</div>
          <h2 className="disp">내가 지나온 정전과 감독들</h2>
          <p className="standfirst">
            바둑판 위 어디를 밟아 왔는지 — 정전 커버리지와 감독별 정복률. 더 깊이 보려면{" "}
            <Link href="/room" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>My Room →</Link>
          </p>
        </div>

        {canon.length ? (
          <div className="bcov-block">
            <h3 className="bcov-h3">정전 커버리지 <span>Canon coverage</span></h3>
            <div className="bcov-canon">
              {canon.map((c) => (
                <Link key={c.list_id} href={`/lineage/${c.slug}`} className="bcov-bar">
                  <div className="bcov-bar-top">
                    <span className="bcov-bar-label">{c.label}</span>
                    <span className="bcov-bar-num">{c.seen}/{c.total}</span>
                  </div>
                  <div className="bcov-bar-track"><span style={{ width: `${Math.min(100, Math.round(c.pct))}%` }} /></div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {auteurs.length ? (
          <div className="bcov-block">
            <h3 className="bcov-h3">감독 정복률 <span>Auteur conquest</span></h3>
            <div className="bcov-auteurs">
              {auteurs.map((a) => (
                <Link key={a.slug} href={`/director/${a.slug}`} className="bcov-aut" title={`${a.name} · ${a.seen}/${a.total}`}>
                  <span className="bcov-aut-face" style={{ ["--pct" as string]: `${Math.min(100, Math.round(a.pct))}%` }}>
                    {a.profile_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${IMG}/w185${a.profile_path}`} alt="" loading="lazy" />
                    ) : <span className="bcov-aut-ini">{a.name.slice(0, 1)}</span>}
                  </span>
                  <span className="bcov-aut-name">{a.name}</span>
                  <span className="bcov-aut-num">{a.seen}/{a.total}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {!canon.length && !auteurs.length ? (
          <div className="bcov-empty">아직 본 영화가 적어요. 영화를 몇 편 표시하면 여기에 커버리지가 채워집니다.</div>
        ) : null}
      </section>
    );
  } catch {
    return user ? null : <SignIn />;
  }
}

function SignIn() {
  return (
    <section className="bcov">
      <div className="bcov-signin">
        로그인하면 <b>정전·감독 커버리지</b>가 이 아래 펼쳐집니다 — 바둑판 위 나의 발자취.{" "}
        <Link href="/login?next=/board" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>로그인 →</Link>
      </div>
    </section>
  );
}
