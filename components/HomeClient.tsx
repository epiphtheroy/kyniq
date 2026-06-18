"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import Link from "next/link";
import HomeConstellation from "@/components/HomeConstellation";

const W780 = "https://image.tmdb.org/t/p/w780";
const W300 = "https://image.tmdb.org/t/p/w300";

type Side = { f: string; y: number | null; d: string | null; fs: string; fig: string; figslug: string | null; bd: string | null };
type Pair = { mt: string; slug: string; lac: string | null; n: number; a: Side; b: Side };
type Stats = { films: number; figures: number; takes: number; metas: number; tropes: number };
type Doors = { meta: { t: string; n: number }[]; trope: { t: string; lac: string | null }[]; director: { name: string; n: number }[]; concept: { t: string; n: number }[] };
type Tick = { kind: string; x: string; s: string | null };
export type HomeBundle = { pairs: Pair[]; stats: Stats; doors: Doors; ticker: Tick[] };

const TICK_COLOR: Record<string, string> = { "Meta take": "#E3120B", "Trope": "#167C6B", "Reading": "#A8434F", "Concept": "#2E6F8E" };
const onImg = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("hm-on");
const imgRef = (el: HTMLImageElement | null) => { if (el && el.complete) el.classList.add("hm-on"); };

function figHref(s: Side) { return s.figslug ? `/film/${s.fs}/figure/${s.figslug}` : `/film/${s.fs}`; }

function Gauges({ stats }: { stats: Stats }) {
  const nodes = stats.films + stats.figures + stats.metas + stats.tropes;
  const targets: [number, string][] = [
    [stats.films, "Films"], [stats.figures, "Figures"], [stats.takes, "Takes"],
    [stats.metas, "Meta-takes"], [stats.tropes, "Tropes"], [nodes, "Nodes"],
  ];
  const ref = useRef<HTMLDivElement>(null);
  const [vals, setVals] = useState<number[]>(targets.map(() => 0));
  const [lit, setLit] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !done.current) {
          done.current = true; setLit(true);
          const t0 = performance.now(), dur = 1300;
          const step = (now: number) => {
            const p = Math.min(1, (now - t0) / dur), e2 = 1 - Math.pow(1 - p, 3);
            setVals(targets.map(([t]) => Math.round(t * e2)));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      });
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hm-gauges" ref={ref}>
      {targets.map(([, k], i) => (
        <div className={`hm-gauge${lit ? " lit" : ""}`} key={k}>
          <div className="n">{vals[i].toLocaleString("en-US")}</div>
          <div className="k">{k}</div>
        </div>
      ))}
    </div>
  );
}

function useRotator(len: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (len < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % len), ms);
    return () => window.clearInterval(t);
  }, [len, ms]);
  return i;
}

const REGS: [string, string][] = [
  ["Formal", "#5B8FB9"], ["Semiotic", "#B8860B"], ["Psychoanalytic", "#A8434F"], ["Ideological", "#C0392B"],
  ["Politico-economic", "#2E7D5B"], ["Philosophical", "#7E57C2"], ["Existential", "#546E7A"], ["Mythic", "#A9743B"],
  ["Film-historical", "#2E86C1"], ["Reception", "#159A8A"],
];

export default function HomeClient({ bundle }: { bundle: HomeBundle }) {
  const { pairs, stats, doors, ticker } = bundle;
  const n = pairs.length;
  const [pIdx, setPIdx] = useState(0);
  const [swap, setSwap] = useState(false);
  const [draw, setDraw] = useState(false);
  const holding = useRef(false);
  const busy = useRef(false);

  const go = (next: number) => {
    if (busy.current) return;
    busy.current = true;
    setSwap(true);
    window.setTimeout(() => { setPIdx(((next % n) + n) % n); setSwap(false); busy.current = false; }, 260);
  };

  useEffect(() => { setDraw(false); const r = requestAnimationFrame(() => setDraw(true)); return () => cancelAnimationFrame(r); }, [pIdx]);
  useEffect(() => {
    if (n < 2) return;
    const t = window.setInterval(() => { if (!holding.current) go(pIdx + 1); }, 9000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pIdx, n]);

  const dMeta = useRotator(doors.meta.length, 5200);
  const dTrope = useRotator(doors.trope.length, 5600);
  const dDir = useRotator(doors.director.length, 6000);
  const dConcept = useRotator(doors.concept.length, 5400);
  const tIdx = useRotator(ticker.length, 7000);

  const p = pairs[pIdx];

  return (
    <main className="hm">
      {/* method bar */}
      <section className="hm-basis">
        <div className="hm-basis__row">
          <span className="glyph">▦</span>
          <p className="hm-basis__t"><b>Built on AI embeddings — not AI-generated content.</b> The model does not write opinions or invent films. It turns every <i>real</i> film, figure and reading into a point in meaning-space, then measures which works secretly rhyme — connections no human index would catch. <span className="hm-em">The readings are criticism; the AI is the instrument that finds them.</span></p>
        </div>
      </section>

      {/* hero — the unlikely pair */}
      <section className="hm-hero">
        <div className="hm-wrap">
          <p className="hm-kick"><span className="dot" /> The unlikely pair</p>
          <h1 className="hm-h1">Two films you&apos;d never shelve together — and the <em>line</em> between them.</h1>
          <p className="hm-lead">metatake reads thousands of films as points in meaning-space, then draws the unconscious lines between them. <b>Here is one of those lines</b>, redrawn each time you look — two films that share almost nothing on the surface, and one idea underneath.</p>

          {p && (
            <div className="hm-exhibit">
              <div className="hm-exhead">
                <span className="hm-exlabel"><span className="exdot" /> Featured line</span>
                <span className="hm-excount"><b>{String(pIdx + 1).padStart(2, "0")}</b> / {n}</span>
                <span className="hm-exsp" />
                <span className="hm-exhint">auto-rotates · hover to hold</span>
                <div className="hm-pdots">
                  {pairs.map((_, i) => <i key={i} className={i === pIdx ? "on" : ""} onClick={() => go(i)} />)}
                </div>
                <button className="hm-another" onClick={() => go(pIdx + 1)}>↻ Another</button>
              </div>
              <div className="hm-exbody">
                <div className="hm-stage" onMouseEnter={() => (holding.current = true)} onMouseLeave={() => (holding.current = false)}>
                  <div className={`hm-fcard left${swap ? " swap" : ""}`}>
                    <Link className="hm-bd" href={`/film/${p.a.fs}`}>{p.a.bd && <img ref={imgRef} onLoad={onImg} src={`${W780}${p.a.bd}`} alt="" />}<span className="ord">Film A</span></Link>
                    <div className="ftitle">{p.a.f}</div>
                    <div className="fmeta">{[p.a.y, p.a.d].filter(Boolean).join(" · ")}</div>
                    <div className="fvia"><span className="v">via</span> <i>{p.a.fig}</i></div>
                  </div>

                  <div className={`hm-tie${draw ? " draw" : ""}`}>
                    <div className="barwrap"><span className="barL" /><span className="barR" /></div>
                    <div className="knot" />
                    <div className="pill">
                      <div className="both">Both are really about</div>
                      <Link className="mttitle" href={`/take/${p.slug}`}>{p.mt}</Link>
                      {p.lac && <p className="mtlac">“{p.lac}”</p>}
                      <Link className="cta" href={`/take/${p.slug}`}>Open this reading →</Link>
                    </div>
                  </div>

                  <div className={`hm-fcard right${swap ? " swap" : ""}`}>
                    <Link className="hm-bd" href={`/film/${p.b.fs}`}>{p.b.bd && <img ref={imgRef} onLoad={onImg} src={`${W780}${p.b.bd}`} alt="" />}<span className="ord">Film B</span></Link>
                    <div className="ftitle">{p.b.f}</div>
                    <div className="fmeta">{[p.b.y, p.b.d].filter(Boolean).join(" · ")}</div>
                    <div className="fvia"><span className="v">via</span> <i>{p.b.fig}</i></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="hm-gallerywrap">
            <div className="hm-gallhead">
              <span className="gk">Ten lines, on screen at once —</span>
              <span className="gsub">and {stats.metas} meta-takes, {stats.takes.toLocaleString()} readings underneath. The map redraws every night.</span>
            </div>
            <div className="hm-gallery">
              {pairs.map((pp, i) => (
                <button className={`hm-gbox${i === pIdx ? " active" : ""}`} key={i} onClick={() => go(i)}>
                  <div className="duo">
                    <span className="gthumb">{pp.a.bd && <img src={`${W300}${pp.a.bd}`} alt="" loading="lazy" />}</span>
                    <span className="gln" />
                    <span className="gthumb">{pp.b.bd && <img src={`${W300}${pp.b.bd}`} alt="" loading="lazy" />}</span>
                  </div>
                  <div className="gmeta">
                    <div className="gmt">{pp.mt}</div>
                    <div className="gfilms">{pp.a.f} <i>⟷</i> {pp.b.f}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* concept chain */}
      <section className="hm-sec">
        <div className="hm-wrap">
          <p className="hm-sec__k">How a reading is built</p>
          <h2 className="hm-phil">Not <span className="x">reviews</span>. Not <span className="x">ratings</span>. <span className="y">Readings</span>.</h2>
          <p className="hm-sec__s">Every line on this site is built the same way — from the single film up to the idea that gathers many of them. This chain is the whole grammar of metatake.</p>
          <div className="hm-chain">
            <div className="cnode"><div className="step">01 · where it starts</div><div className="nm">Film <span className="ar">→</span></div><div className="df">A single movie — the ground everything is read from.</div><div className="eg"><b>Black Swan</b> (2010)</div></div>
            <div className="cnode"><div className="step">02 · what it returns to</div><div className="nm">Figure <span className="ar">→</span></div><div className="df">A concrete thing the film keeps returning to — an object, a gesture, a colour, a body. A figure can be a trope.</div><div className="eg"><b>Nina&apos;s bodily mutations</b> — skin, quills, feathers</div></div>
            <div className="cnode"><div className="step">03 · the close reading</div><div className="nm">Take <span className="ar">→</span></div><div className="df">One reading of that figure, backed by evidence and filed under one of ten critical registers.</div><div className="eg"><b>Psychoanalytic</b> — the body confesses what the self denies</div></div>
            <div className="cnode hub"><div className="step">04 · the idea that gathers</div><div className="nm">Meta-take</div><div className="df">The concept that surfaces when the same reading crosses many films. The hub — and the main character of this site.</div><div className="eg"><b>The Flesh That Changes Shape</b></div></div>
          </div>
          <div className="hm-regline">Ten registers:
            {REGS.map(([label, c]) => <span className="regchip" key={label} style={{ background: c }}>{label}</span>)}
          </div>
        </div>
      </section>

      {/* scale / engine */}
      <section className="hm-sec">
        <div className="hm-wrap">
          <div className="hm-scalegrid">
            <div>
              <p className="hm-sec__k">The machine underneath</p>
              <Gauges stats={stats} />
            </div>
            <div>
              <p className="hm-method"><b>A large-scale AI project.</b> Every figure, take and film becomes an <b>embedding</b> — a point in meaning-space. The model then reads the geometry: nearest neighbours by cosine distance are the <b>rhymes between films</b> that no human index would ever catch. The pair above was found exactly this way.
                <span className="spec"><span>text-embedding-3-small</span><span>1,536 dimensions</span><span>cosine k-NN</span></span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* constellation */}
      <section className="hm-sec">
        <div className="hm-wrap">
          <p className="hm-sec__k">Wander the map</p>
          <h2 className="hm-sec__h">The constellation is alive</h2>
          <p className="hm-sec__s">The one place on this paper where colour is allowed to glow. Each star is a film or a figure; the lines are cosine-near neighbours. Drag to pan, scroll to zoom, hover a star to light up its neighbours.</p>
          <HomeConstellation pairs={pairs} />
        </div>
      </section>

      {/* doors */}
      <section className="hm-sec">
        <div className="hm-wrap">
          <p className="hm-sec__k">Start anywhere</p>
          <h2 className="hm-sec__h">Four ways in</h2>
          <p className="hm-sec__s">There is no front of the book. Pull any thread — the films, the ideas that gather them, the auteurs who keep returning, or the theory behind every reading.</p>
          <div className="hm-doors">
            <Link className="hm-door" href="/meta-takes"><span className="bar" style={{ background: "var(--meta)" }} /><div className="dc" style={{ color: "var(--meta)" }}>{stats.metas} hubs</div><div className="dn">Meta takes</div><p className="ds">The ideas that gather films from across decades and genres.</p><p className="sample">{doors.meta[dMeta] ? `${doors.meta[dMeta].t} — across ${doors.meta[dMeta].n} films` : ""}</p><span className="go">All meta takes →</span></Link>
            <Link className="hm-door" href="/tropes"><span className="bar" style={{ background: "var(--trope)" }} /><div className="dc" style={{ color: "var(--trope)" }}>{stats.tropes} figure-types</div><div className="dn">Tropes</div><p className="ds">The shapes cinema keeps reaching for, again and again.</p><p className="sample">{doors.trope[dTrope] ? `${doors.trope[dTrope].t}${doors.trope[dTrope].lac ? " — " + doors.trope[dTrope].lac : ""}` : ""}</p><span className="go">All tropes →</span></Link>
            <Link className="hm-door" href="/director"><span className="bar" style={{ background: "var(--director)" }} /><div className="dc" style={{ color: "var(--director)" }}>auteur fingerprints</div><div className="dn">Directors</div><p className="ds">Signature readings and tropes that recur across a filmography.</p><p className="sample">{doors.director[dDir] ? `${doors.director[dDir].name} — ${doors.director[dDir].n} films` : ""}</p><span className="go">All directors →</span></Link>
            <Link className="hm-door" href="/concept"><span className="bar" style={{ background: "var(--concept)" }} /><div className="dc" style={{ color: "var(--concept)" }}>the theory</div><div className="dn">Concepts</div><p className="ds">The critical ideas the readings are built on.</p><p className="sample">{doors.concept[dConcept] ? `${doors.concept[dConcept].t} — ${doors.concept[dConcept].n} films` : ""}</p><span className="go">All concepts →</span></Link>
          </div>

          {ticker.length > 0 && ticker[tIdx] && (
            <div className="hm-ticker">
              <span className="lbl">Just added</span>
              <span className="item"><span className="t" style={{ background: TICK_COLOR[ticker[tIdx].kind] ?? "var(--ink)" }}>{ticker[tIdx].kind}</span><b>{ticker[tIdx].x}</b>{ticker[tIdx].s ? ` — ${ticker[tIdx].s}` : ""}</span>
            </div>
          )}
        </div>
      </section>

      {/* manifesto */}
      <section className="hm-mani">
        <div className="hm-wrap">
          <p>For people who can&apos;t stop thinking about films, metatake finds the <span className="em">unconscious lines</span> between them — and hands you the thread.</p>
          <p className="by">No reviews. No scores. No ranking what is &quot;best.&quot; Only readings — and the connections an index would never make.</p>
        </div>
      </section>
    </main>
  );
}
