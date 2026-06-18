"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import Link from "next/link";

const W500 = "https://image.tmdb.org/t/p/w500";
const W342 = "https://image.tmdb.org/t/p/w342";
const W185 = "https://image.tmdb.org/t/p/w185";

const ENT: Record<string, string> = { film: "#26303B", meta: "#E3120B", trope: "#167C6B", director: "#6B4E9E", concept: "#2E6F8E" };
const ENTL: Record<string, string> = { film: "Film", meta: "Meta take", trope: "Trope", director: "Director", concept: "Concept" };
const REGC: Record<string, string> = {
  psychoanalytic: "#A8434F", formal: "#5B8FB9", mythic: "#A9743B", existential: "#546E7A",
  philosophical: "#7E57C2", ideological: "#C0392B", semiotic: "#B8860B", politico_economic: "#2E7D5B",
  genealogical: "#2E86C1", reception: "#159A8A",
};
const REGL: Record<string, string> = {
  psychoanalytic: "Psychoanalytic", formal: "Formal", mythic: "Mythic", existential: "Existential",
  philosophical: "Philosophical", ideological: "Ideological", semiotic: "Semiotic", politico_economic: "Politico-economic",
  genealogical: "Film-historical", reception: "Reception",
};

type Case = { f: string; y: number | null; fig: string; fs: string; figslug: string | null; bd: string | null };
type FilmBox = { title: string; y: number | null; dir: string | null; slug: string; bd: string | null; vias: { fig: string; mt: string; mtslug: string }[]; kin: string[] };
type HubBox = { title: string; slug: string; lac: string | null; cases: Case[] };
type DirBox = { name: string; slug: string; photo: string | null; place: string | null; sig: { t: string; slug: string; fig: string }[] };
type ConceptBox = { title: string; slug: string; n: number };
type ReadingBox = { reg: string | null; fig: string; figslug: string | null; f: string; fs: string; y: number | null; mt: string; mtslug: string; snip: string };
export type LatestPool = {
  films: FilmBox[]; metas: HubBox[]; tropes: HubBox[]; directors: DirBox[]; concepts: ConceptBox[]; readings: ReadingBox[];
};

const PATTERN = ["film", "meta", "reading", "director", "trope", "reading", "concept", "meta", "reading", "film", "trope", "director", "reading", "concept", "reading", "meta"] as const;

const onImg = (e: SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  img.classList.add("lt-on");
  const box = img.closest(".lt-box") as HTMLElement | null;
  if (box) sizeBox(box);
};
const imgRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("lt-on"); };

function sizeBox(box: HTMLElement) {
  const inner = box.firstElementChild as HTMLElement | null;
  if (!inner) return;
  const h = inner.getBoundingClientRect().height;
  box.style.gridRowEnd = `span ${Math.max(2, Math.ceil((h + 18) / 28))}`;
}

function Band({ t, label, color }: { t?: string; label?: string; color?: string }) {
  const bg = color ?? ENT[t ?? "film"];
  return <span className="lt-band" style={{ background: bg }}>{label ?? ENTL[t ?? "film"]}</span>;
}

function CaseRows({ cases }: { cases: Case[] }) {
  return (
    <div className="lt-cases">
      {cases.map((c, i) => (
        <span className="lt-case" key={i}>
          <span className="lt-ctx">
            <span className="lt-cf">{c.f} {c.y ? <span className="yr">({c.y})</span> : null}</span>
            <span className="lt-cv"><span className="v">via</span> {c.fig}</span>
          </span>
          <span className="lt-cth">{c.bd && <img ref={imgRef} onLoad={onImg} src={`${W342}${c.bd}`} alt="" />}</span>
        </span>
      ))}
    </div>
  );
}

function Box({ d, type }: { d: unknown; type: string }) {
  if (type === "film") {
    const f = d as FilmBox;
    return (
      <div className="lt-box lt-box--wide">
        <Link className="lt-inner" href={`/film/${f.slug}`}>
          <span className="lt-ph">{f.bd && <img ref={imgRef} onLoad={onImg} src={`${W500}${f.bd}`} alt="" />}</span>
          <Band t="film" />
          <span className="lt-body">
            <span className="lt-hl">{f.title} {f.y ? <span className="yr">({f.y})</span> : null}</span>
            {f.dir && <span className="lt-dir">dir. {f.dir}</span>}
            <ul className="lt-vias">
              {f.vias.map((v, i) => <li key={i}><span className="vfig">{v.fig}</span><span className="va">→</span><b>{v.mt}</b></li>)}
            </ul>
            {f.kin.length > 0 && <span className="lt-kin"><span className="o">Movies like</span>{f.kin.join(" · ")}</span>}
          </span>
        </Link>
      </div>
    );
  }
  if (type === "meta" || type === "trope") {
    const m = d as HubBox;
    const wide = type === "meta";
    return (
      <div className={`lt-box${wide ? " lt-box--wide" : ""}`}>
        <Link className="lt-inner" href={`/${type === "meta" ? "take" : "trope"}/${m.slug}`}>
          <Band t={type} />
          <span className="lt-body">
            <span className="lt-hl">{m.title}</span>
            {m.lac && <span className="lt-lacm">{m.lac}</span>}
            {m.cases.length > 0 && <CaseRows cases={m.cases} />}
          </span>
        </Link>
      </div>
    );
  }
  if (type === "director") {
    const dd = d as DirBox;
    return (
      <div className="lt-box">
        <Link className="lt-inner" href={`/director/${dd.slug}`}>
          <Band t="director" />
          <span className="lt-body">
            <span className="lt-drow">
              {dd.photo && <img className="lt-dph" ref={imgRef} onLoad={onImg} src={`${W185}${dd.photo}`} alt="" />}
              <span><span className="lt-hl">{dd.name}</span>{dd.place && <span className="lt-dpl">{dd.place}</span>}</span>
            </span>
            <ul className="lt-vias">
              {dd.sig.map((s, i) => <li key={i}><span className="vfig">{s.fig}</span><span className="va">→</span><b>{s.t}</b></li>)}
            </ul>
          </span>
        </Link>
      </div>
    );
  }
  if (type === "concept") {
    const c = d as ConceptBox;
    return (
      <div className="lt-box">
        <Link className="lt-inner" href={`/concept/${c.slug}`}>
          <Band t="concept" />
          <span className="lt-body">
            <span className="lt-hl">{c.title}</span>
            <span className="lt-cmeta">{c.n} {c.n === 1 ? "film embodies" : "films embody"} it</span>
          </span>
        </Link>
      </div>
    );
  }
  // reading
  const r = d as ReadingBox;
  const reg = r.reg ?? "formal";
  return (
    <div className="lt-box">
      <Link className="lt-inner" href={r.figslug ? `/film/${r.fs}/figure/${r.figslug}` : `/film/${r.fs}`}>
        <Band color={REGC[reg] ?? "#5B8FB9"} label={`Reading · ${REGL[reg] ?? reg}`} />
        <span className="lt-body">
          <span className="lt-hl">{r.fig}</span>
          <span className="lt-dir">{r.f} · {r.y}</span>
          <p className="lt-snip">{r.snip}</p>
          <span className="lt-kin"><span className="o">reads as</span><b>{r.mt}</b></span>
        </span>
      </Link>
    </div>
  );
}

export default function LatestMagazine({ pool }: { pool: LatestPool }) {
  const magRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(12);

  const types = useMemo(() => PATTERN.filter((t) => (pool[(t + "s") as keyof LatestPool] ?? []).length > 0), [pool]);

  const seq = useMemo(() => {
    if (types.length === 0) return [] as { type: string; d: unknown; key: string }[];
    const cur: Record<string, number> = {};
    const out: { type: string; d: unknown; key: string }[] = [];
    for (let i = 0; i < count; i++) {
      const t = types[i % types.length];
      const arr = pool[(t + "s") as keyof LatestPool] as unknown[];
      const idx = (cur[t] ?? 0); cur[t] = idx + 1;
      out.push({ type: t, d: arr[idx % arr.length], key: `${t}-${i}` });
    }
    return out;
  }, [pool, types, count]);

  useLayoutEffect(() => {
    const mag = magRef.current; if (!mag) return;
    Array.from(mag.children).forEach((c) => sizeBox(c as HTMLElement));
  }, [seq]);

  useEffect(() => {
    let rt: number | undefined;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        const mag = magRef.current; if (!mag) return;
        Array.from(mag.children).forEach((c) => sizeBox(c as HTMLElement));
      }, 150);
    };
    window.addEventListener("resize", onResize);
    return () => { window.clearTimeout(rt); window.removeEventListener("resize", onResize); };
  }, []);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setCount((c) => c + 8); });
    }, { rootMargin: "700px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="lt-mag" ref={magRef}>
        {seq.map((b) => <Box key={b.key} d={b.d} type={b.type} />)}
      </div>
      <div className="lt-loader" ref={sentinel}>editing in more features <span className="dot" /><span className="dot" /><span className="dot" /></div>
    </>
  );
}
