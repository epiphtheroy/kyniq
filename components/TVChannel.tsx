"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNavClient from "@/components/home2/SiteNavClient";
import MetatakeTV from "@/components/MetatakeTV";
import type { SurpriseCard } from "@/components/home2/SurpriseStage";

const IMG = "https://image.tmdb.org/t/p";

// TVChannel — the full-page METATAKE TV channel (served at /tv/fullscreen): the
// TV plays large at the top, and a live "dossier" beneath pulls in whatever the
// broadcast is currently on (the film, the lens in full, deep links) so it
// doubles as a way into the site. The main watch interface is at /tv.
export default function TVChannel() {
  const [card, setCard] = useState<SurpriseCard | null>(null);
  return (
    <div className="mt tvpg">
      <SiteNavClient />
      <div className="tvpg-wrap">
        <header className="tvpg-head">
          <a className="tvpg-brand" href="/tv">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● ON AIR</span>
          </a>
          <p className="tvpg-tag">The channel that never stops reading films — one film, one lens at a time. Leave it on.</p>
          <a className="tvpg-full" href="/tv">← Watch &amp; browse</a>
          <a className="tvpg-full" href="/tv/full">Full-screen ↗</a>
        </header>

        <div className="tv-stage"><MetatakeTV embed onCard={setCard} /></div>

        <TVDossier card={card} />
      </div>
    </div>
  );
}

// The live "page-within-page" beneath the TV — the current broadcast, expanded.
function TVDossier({ card }: { card: SurpriseCard | null }) {
  if (!card) return <div className="tvd tvd--skel">Tuning in…</div>;
  const filmLine = [card.film_title, card.film_year ? `(${card.film_year})` : null].filter(Boolean).join(" ");
  const items = card.items ?? [];
  const chips = (card.chips ?? (card.groups ?? []).flatMap((g) => g.chips)).map((c) => c.text);
  const head = card.mode === "misreading" ? card.line : card.subject;

  return (
    <section className="tvd" aria-live="polite">
      <div className="tvd-rail">
        <span className="tvd-kick">Now on air</span>
        {card.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tvd-poster" src={`${IMG}/w342${card.poster}`} alt="" />
        ) : null}
        <h2 className="tvd-film">{card.film_slug ? <Link href={`/film/${card.film_slug}`}>{filmLine}</Link> : filmLine}</h2>
        {card.director ? (
          <p className="tvd-dir">dir. {card.director_slug ? <Link href={`/director/${card.director_slug}`}>{card.director}</Link> : card.director}</p>
        ) : null}
        <div className="tvd-jumps">
          {card.film_slug ? <a className="tvd-jump" href={`/film/${card.film_slug}`}>The film ↗</a> : null}
          {card.href ? <a className="tvd-jump tvd-jump--acc" href={card.href}>{card.label ?? "This piece"} ↗</a> : null}
          {card.director_slug ? <a className="tvd-jump" href={`/director/${card.director_slug}`}>The director ↗</a> : null}
        </div>
      </div>

      <div className="tvd-body">
        {card.label ? <span className="tvd-kick tvd-kick--acc">{card.label}</span> : null}
        {head ? <h3 className="tvd-subj">{head}</h3> : null}
        {card.intro ? <p className="tvd-intro">{card.intro}</p> : null}
        {card.body ? <p className="tvd-p">{card.body}</p> : null}
        {card.leap ? <p className="tvd-leap"><span>The leap</span> {card.leap}</p> : null}
        {chips.length ? (
          <div className="tvd-chips">{chips.slice(0, 20).map((c, i) => <span key={i} className="tvd-chip">{c}</span>)}</div>
        ) : null}
        {items.length ? (
          <ul className="tvd-list">
            {items.slice(0, 8).map((it, i) => (
              <li key={i}>
                <b>{it.text ?? it.title ?? it.name}{it.year ? ` (${it.year})` : ""}</b>
                {it.reason || it.label ? <span> — {it.reason ?? it.label}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {card.href ? <a className="tvd-more" href={card.href}>Read this in full ↗</a> : null}
      </div>
    </section>
  );
}
