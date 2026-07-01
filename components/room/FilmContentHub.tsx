"use client";
/** ⑥ Film content hub — turns any film inspector into a launchpad into the site's content graph:
 *  watch-next chain + movies-like + Atlas filming locations + availability. Fetched by slug,
 *  reused everywhere via CinecodexCard. Real data from film_room_context RPC. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Next = { position: number; title: string; yr: number | null; slug: string | null; poster_path: string | null; reason: string | null };
type Like = { slug: string; title: string; yr: number | null; poster_path: string | null; score: number };
type Loc = { name: string; country: string | null; kind: string | null; narrative_setting: string | null; lat: number; lng: number; layer: string | null };
type Ctx = { watch_next: Next[] | null; movies_like: Like[] | null; locations: Loc[] | null; loc_count: number; avail: { state: string; provider?: string } | null };

const IMG = "https://image.tmdb.org/t/p/w92";

export default function FilmContentHub({ slug }: { slug: string }) {
  const [d, setD] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const sb = createClient();
    setLoading(true);
    sb.rpc("film_room_context", { p_slug: slug }).then(({ data }) => {
      if (alive) { setD((data as Ctx) ?? null); setLoading(false); }
    });
    return () => { alive = false; };
  }, [slug]);

  if (loading) return <div className="fh"><div className="fh-load">콘텐츠 그래프 불러오는 중…</div></div>;
  if (!d) return null;
  const wn = d.watch_next ?? [], ml = d.movies_like ?? [], loc = d.locations ?? [];
  if (!wn.length && !ml.length && !loc.length && !d.avail) return null;

  return (
    <div className="fh">
      <div className="fh-h"><i className="ti ti-arrow-ramp-right" /> 이 영화에서 →</div>

      {d.avail ? (
        <div className="fh-avail">
          {d.avail.state === "on"
            ? <><span className="availdot on" /> 지금 볼 수 있음 · <b>{d.avail.provider}</b> <span className="fh-dim">(KR)</span></>
            : <><span className="availdot unk" /> 가용성 미확인 <span className="fh-dim">(≠ 안 됨)</span></>}
        </div>
      ) : null}

      {wn.length ? (
        <div className="fh-sec">
          <div className="fh-lbl">이어보기 · Watch next</div>
          {wn.slice(0, 3).map((n, i) => {
            const inner = (
              <>
                {n.poster_path ? <img className="fh-th" src={`${IMG}${n.poster_path}`} alt="" loading="lazy" /> : <span className="fh-th fh-th--e" />}
                <div className="fh-nb"><div className="fh-nt">{n.title} <span className="fh-dim">{n.yr ?? ""}</span></div>
                  {n.reason ? <div className="fh-rz">{n.reason}</div> : null}</div>
              </>
            );
            return n.slug
              ? <Link key={i} className="fh-row" href={`/room/film/${n.slug}`}>{inner}</Link>
              : <div key={i} className="fh-row fh-row--dead">{inner}</div>;
          })}
        </div>
      ) : null}

      {ml.length ? (
        <div className="fh-sec">
          <div className="fh-lbl">비슷한 영화 · Movies like</div>
          <div className="fh-strip">
            {ml.map((m, i) => (
              <Link key={i} className="fh-poster" href={`/room/film/${m.slug}`} title={`${m.title} (${m.yr ?? "?"})`}>
                {m.poster_path ? <img src={`${IMG}${m.poster_path}`} alt="" loading="lazy" /> : <span className="fh-poster--e">{m.title.slice(0, 2)}</span>}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {loc.length ? (
        <div className="fh-sec">
          <div className="fh-lbl"><i className="ti ti-map-pin" /> 촬영지 · Atlas <span className="fh-dim">{d.loc_count}곳</span></div>
          {loc.slice(0, 3).map((l, i) => (
            <div className="fh-loc" key={i}>
              <span className={`fh-locdot ${l.layer === "filmed" ? "filmed" : "setting"}`} />
              <span className="fh-locn">{l.name}</span>
              {l.country ? <span className="fh-dim">· {l.country}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
