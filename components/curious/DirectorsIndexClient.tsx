"use client";

/**
 * DirectorsIndexClient — the interactive roster on /curious/directors
 * (2026-07-09): in-page filter, A–Z jump bar, and sort by name / country /
 * year / most-researched. All rows are rendered in the SSR HTML (client
 * components server-render too), so every director link stays crawlable; the
 * JS only filters/reorders what's already there.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { SectionHead } from "@/components/curious/ui";
import type { DirRow } from "@/app/curious/directors/page";

const IMG = "https://image.tmdb.org/t/p";

type Sort = "name" | "country" | "year" | "layers";

const layerCount = (d: DirRow) =>
  (d.life > 0 ? 1 : 0) + (d.start > 0 ? 1 : 0) + (d.next > 0 ? 1 : 0) +
  (d.locations ? 1 : 0) + (d.takescore ? 1 : 0) + (d.honors ? 1 : 0) + (d.reception ? 1 : 0) + (d.theory ? 1 : 0) + (d.misreadings ? 1 : 0);

function letterOf(name: string): string {
  const c = name.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

function linksFor(d: DirRow): { href: string; label: string }[] {
  const out: { href: string; label: string }[] = [];
  if (d.life > 0) out.push({ href: `/director/${d.slug}/life`, label: `The life (${d.life})` });
  if (d.start > 0) out.push({ href: `/director/${d.slug}/start`, label: `Where to start (${d.start})` });
  if (d.next > 0) out.push({ href: `/director/${d.slug}/next`, label: `Who's next (${d.next})` });
  if (d.misreadings) out.push({ href: `/director/${d.slug}/misreadings`, label: "Strong Misreadings" });
  if (d.locations) out.push({ href: `/director/${d.slug}/locations`, label: "Locations" });
  if (d.takescore) out.push({ href: `/director/${d.slug}/takescore`, label: "TakeScore" });
  if (d.honors) out.push({ href: `/director/${d.slug}/honors`, label: "Honors" });
  if (d.reception) out.push({ href: `/director/${d.slug}/reception`, label: "Reception" });
  if (d.theory) out.push({ href: `/director/${d.slug}/theory`, label: "Theory" });
  out.push({ href: `/director/${d.slug}`, label: "Hub" });
  return out;
}

function Row({ d }: { d: DirRow }) {
  return (
    <div className="cur-qindex__film cdir-row" data-name={d.name.toLowerCase()} data-country={(d.country ?? "").toLowerCase()} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {d.profile_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${IMG}/w92${d.profile_path}`} alt="" loading="lazy" width={40} height={40}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flex: "none", background: "#0c0c0c" }} />
        ) : null}
        <Link href={`/director/${d.slug}`} style={{ fontFamily: "var(--cur-display)", fontWeight: 600, fontSize: 17, color: "#fff" }}>
          {d.name}
        </Link>
        {(d.country || d.birthYear) ? (
          <span style={{ fontSize: 11.5, color: "#6f6d6e", fontFamily: "var(--cur-text)" }}>
            {d.country || ""}{d.country && d.birthYear ? " · " : ""}{d.birthYear ? `b. ${d.birthYear}` : ""}
          </span>
        ) : null}
      </div>
      <div style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.8, color: "#5f5d5e" }}>
        {linksFor(d).map((l, i) => (
          <span key={l.href}>{i > 0 ? " · " : ""}<Link href={l.href} style={{ color: "#cfcdce" }}>{l.label}</Link></span>
        ))}
      </div>
    </div>
  );
}

export default function DirectorsIndexClient({ rows }: { rows: DirRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? rows.filter((d) => d.name.toLowerCase().includes(needle) || (d.country ?? "").toLowerCase().includes(needle))
      : rows;
    const arr = [...base];
    if (sort === "country") arr.sort((a, b) => (a.country || "￿").localeCompare(b.country || "￿") || a.name.localeCompare(b.name));
    else if (sort === "year") arr.sort((a, b) => (a.birthYear ?? 99999) - (b.birthYear ?? 99999) || a.name.localeCompare(b.name));
    else if (sort === "layers") arr.sort((a, b) => layerCount(b) - layerCount(a) || a.name.localeCompare(b.name));
    else arr.sort((a, b) => a.name.localeCompare(b.name, "en"));
    return arr;
  }, [rows, q, sort]);

  // Grouping: A–Z only in name mode; country groups in country mode; flat otherwise.
  const groups = useMemo(() => {
    const m = new Map<string, DirRow[]>();
    for (const d of filtered) {
      const key = sort === "country" ? (d.country || "Unknown")
        : sort === "name" ? letterOf(d.name)
        : sort === "year" ? (d.birthYear ? `${Math.floor(d.birthYear / 10) * 10}s` : "Year unknown")
        : "All";
      (m.get(key) ?? m.set(key, []).get(key)!).push(d);
    }
    return [...m.entries()];
  }, [filtered, sort]);

  const azLetters = useMemo(
    () => (sort === "name" ? groups.map(([k]) => k).filter((k) => k !== "#").concat(groups.some(([k]) => k === "#") ? ["#"] : []) : []),
    [groups, sort],
  );

  return (
    <div>
      <div className="cdir-ctrl">
        <input
          className="cdir-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${rows.length} directors — name or country…`}
          aria-label="Filter directors"
          autoComplete="off"
        />
        <div className="cdir-sort" role="group" aria-label="Sort directors">
          {(["name", "country", "year", "layers"] as Sort[]).map((s) => (
            <button key={s} type="button" className={`cdir-sortb${sort === s ? " active" : ""}`} onClick={() => setSort(s)}>
              {s === "name" ? "A–Z" : s === "country" ? "Country" : s === "year" ? "Born" : "Most researched"}
            </button>
          ))}
        </div>
      </div>

      {azLetters.length > 1 ? (
        <div className="cdir-az" aria-label="Jump to letter">
          {azLetters.map((L) => (
            <a key={L} href={`#az-${L === "#" ? "sym" : L}`}>{L}</a>
          ))}
        </div>
      ) : null}

      {q.trim() ? <p className="cdir-count">{filtered.length} of {rows.length}</p> : null}

      {filtered.length === 0 ? (
        <p style={{ opacity: 0.6, padding: "20px 0" }}>No directors match “{q}”.</p>
      ) : (
        groups.map(([key, items]) => (
          <section key={key} id={sort === "name" ? `az-${key === "#" ? "sym" : key}` : undefined} style={{ scrollMarginTop: 80 }}>
            <SectionHead title={key} count={`${items.length} director${items.length === 1 ? "" : "s"}`} />
            <div className="cur-qindex" style={{ columns: 3 }}>
              {items.map((d) => <Row key={d.slug} d={d} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
