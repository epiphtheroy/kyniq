"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";

export default function BigSearch({ data }: { data: HomeV2 }) {
  const { stats } = data;
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="band p2 bigsearch" style={{ padding: "56px 0" }}>
      <div className="wrap inner">
        <span className="kicker">However you arrived</span>
        <h2>
          Search the map — <em>or ask it anything.</em>
        </h2>
        <form className="sb" onSubmit={submit}>
          <span className="mag">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a film, a director, a figure, a feeling…"
          />
          <button
            type="button"
            className="ask"
            onClick={() => router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask")}
          >
            <span className="dot" />
            Ask&nbsp;AI →
          </button>
        </form>
        <div className="chips">
          <Link className="chip" href="/search?q=the+lingering+close-up+on+a+face">
            The lingering close-up on a face
          </Link>
          <Link className="chip" href="/ask?q=What+recurs+across+films+about+grief%3F">
            What recurs across films about grief?
          </Link>
          <Link className="chip" href="/search?q=films+that+rhyme+with+Aftersun">
            Films that rhyme with Aftersun
          </Link>
        </div>
        <div className="facets">
          Jump to · <Link href="/film">{stats.films.toLocaleString()} Films</Link> ·{" "}
          <Link href="/director">{stats.directors.toLocaleString()} Directors</Link> ·{" "}
          <Link href="/tropes">{stats.tropes.toLocaleString()} Tropes</Link> ·{" "}
          <Link href="/strong-misreadings">{stats.readings.toLocaleString()} Strong Misreadings</Link>
        </div>
      </div>
    </section>
  );
}
