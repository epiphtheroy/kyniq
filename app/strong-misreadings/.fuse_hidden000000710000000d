import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import { FAMILIES, BROWSABLE } from "@/lib/frameworks";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Strong Misreadings — the 14 ways Metatake reads a film",
  description:
    "Browse every Strong Misreading by critical framework — psychoanalytic, ethical, semiotic, formal and more. Bold close readings across all of cinema, searchable lens by lens.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Sample = { tt: string; film: string; fig: string; figslug: string; filmslug: string };
type Ov = Record<string, { n: number; sample: Sample | null }>;

export default async function StrongMisreadingsHub() {
  const { data } = await db().rpc("frameworks_overview");
  const ov = (data as Ov | null) ?? {};
  const total = BROWSABLE.reduce((s, f) => s + (ov[f.key]?.n ?? 0), 0);

  return (
    <div className="mt">
      <MetatakeNav active="misreadings" />
      <div className="mt-wrap sm-hub">
        <h1 className="idx-h1">Strong Misreadings</h1>
        <p className="idx-def">
          <b>A Strong Misreading is the boldest defensible thing a film lets you say through one figure.</b>{" "}
          Metatake reads every film through <strong>14 critical frameworks</strong>, then gathers all{" "}
          {total.toLocaleString()} readings here — so you can follow a single lens across the whole of cinema.{" "}
          <Link href="/about#strong-misreadings">What is a Strong Misreading? →</Link>
        </p>

        <form className="sm-search" action="/strong-misreadings/all" method="get" role="search">
          <input className="sm-search__in" name="q" type="search"
            placeholder={`Search all ${total.toLocaleString()} readings…`} aria-label="Search all Strong Misreadings" />
          <button className="sm-search__go" type="submit">Search →</button>
        </form>

        {FAMILIES.map((fam) => {
          const items = BROWSABLE.filter((f) => f.family === fam.key);
          if (items.length === 0) return null;
          return (
            <section className="sm-fam" key={fam.key}>
              <h2 className="sm-fam__h">{fam.label}</h2>
              <div className="sm-grid">
                {items.map((f) => {
                  const o = ov[f.key];
                  const s = o?.sample ?? null;
                  return (
                    <Link className="sm-card" href={`/strong-misreadings/${f.slug}`} key={f.key}
                      style={{ "--fwc": f.color } as CSSProperties}>
                      <span className="sm-card__bar" />
                      <div className="sm-card__head">
                        <span className="sm-card__name">{f.label}</span>
                        <span className="sm-card__n">{(o?.n ?? 0).toLocaleString()}</span>
                      </div>
                      <p className="sm-card__short">{f.short}</p>
                      {s ? (
                        <p className="sm-card__eg"><span className="k">e.g.</span> {s.tt} <span className="film">— {s.film}</span></p>
                      ) : null}
                      <span className="sm-card__go">Browse {f.label} →</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
