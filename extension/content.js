/**
 * Metatake TakeScore overlay — content script.
 *
 * Detects the film on the current page (JSON-LD @type Movie first, then
 * site-specific fallbacks), asks Metatake's public API for its TakeScore, and
 * floats a small badge that links to the full criticism. Read-only, no tracking,
 * no keys — just the free /api/v1 endpoints (CORS-open). "Meet the user where
 * they already are." See metatake.net/api.
 */
(function () {
  "use strict";
  const BASE = "https://metatake.net";
  if (window.__metatakeBadgeDone) return;
  window.__metatakeBadgeDone = true;

  // ── detect { title, year } ────────────────────────────────────────────────
  function fromJsonLd() {
    const nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (const n of nodes) {
      let data;
      try { data = JSON.parse(n.textContent); } catch { continue; }
      const arr = Array.isArray(data) ? data : (data["@graph"] ? data["@graph"] : [data]);
      for (const o of arr) {
        const t = o && o["@type"];
        const isMovie = t === "Movie" || (Array.isArray(t) && t.includes("Movie")) || t === "TVSeries";
        if (isMovie && o.name) {
          let year = null;
          const dp = o.datePublished || o.dateCreated;
          if (dp && /\d{4}/.test(dp)) year = dp.match(/(\d{4})/)[1];
          return { title: String(o.name), year };
        }
      }
    }
    return null;
  }
  function metaContent(sel) { const el = document.querySelector(sel); return el ? el.getAttribute("content") : null; }
  function fromSite() {
    const host = location.hostname;
    let title = null, year = null;
    if (host.includes("letterboxd.com")) {
      title = (document.querySelector(".headline-1 [itemprop='name'], .headline-1, h1.filmtitle") || {}).textContent;
      year = (document.querySelector(".releaseyear a, small.number a") || {}).textContent;
    } else if (host.includes("themoviedb.org")) {
      title = (document.querySelector(".title h2 a, section.header .title a") || {}).textContent;
      year = (document.querySelector(".title .release_date, span.release_date") || {}).textContent;
    } else if (host.includes("rottentomatoes.com")) {
      title = (document.querySelector('[data-qa="score-panel-movie-title"], h1.title') || {}).textContent
        || metaContent('meta[property="og:title"]');
    } else if (host.includes("en.wikipedia.org")) {
      // only treat as a film if the infobox looks filmic
      if (document.querySelector(".infobox.vevent, .infobox-title")) {
        title = (document.querySelector(".infobox-above, #firstHeading") || {}).textContent;
      }
    }
    if (!title) title = metaContent('meta[property="og:title"]');
    if (title) {
      title = title.replace(/\s*\(\d{4}\).*$/, "").replace(/\s*[-—|].*$/, "").trim();
      const ym = year && String(year).match(/(\d{4})/);
      year = ym ? ym[1] : (function () { const m = document.title.match(/\((\d{4})\)/); return m ? m[1] : null; })();
    }
    return title ? { title, year } : null;
  }

  const film = fromJsonLd() || fromSite();
  if (!film || !film.title || film.title.length < 2) return;

  // ── query Metatake ────────────────────────────────────────────────────────
  const url = `${BASE}/api/v1/films?q=${encodeURIComponent(film.title)}${film.year ? `&year=${film.year}` : ""}&limit=5`;
  fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !Array.isArray(d.films) || d.films.length === 0) return;
    // best match: exact-ish title, prefer analyzed + same year
    const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(film.title);
    let best = d.films.find((f) => norm(f.title) === want && (!film.year || String(f.year) === String(film.year)))
      || d.films.find((f) => norm(f.title) === want)
      || d.films.find((f) => f.analyzed) || d.films[0];
    if (!best) return;
    renderBadge(best);
  }).catch(() => {});

  // ── the floating badge ────────────────────────────────────────────────────
  function renderBadge(f) {
    const wrap = document.createElement("a");
    wrap.href = `${BASE}/film/${f.slug}?utm_source=extension`;
    wrap.target = "_blank";
    wrap.rel = "noopener";
    wrap.id = "metatake-badge";
    const ts = (f.takescore != null) ? Math.round(f.takescore) : "–";
    wrap.innerHTML =
      `<span class="mt-x" title="Hide">×</span>` +
      `<span class="mt-n">${ts}</span>` +
      `<span class="mt-b"><b>TakeScore</b><small>on Metatake — read the criticism →</small></span>`;
    const css = document.createElement("style");
    css.textContent = `
      #metatake-badge{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:.6em;
        text-decoration:none;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        color:#e8eaed;background:#16181d;border:1px solid rgba(255,255,255,.16);border-radius:12px;
        padding:.6em .8em .6em .7em;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:280px;animation:mtIn .25s ease}
      @keyframes mtIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      #metatake-badge .mt-n{font-weight:800;font-size:22px;color:#2dd4bf;flex:0 0 auto}
      #metatake-badge .mt-b{display:flex;flex-direction:column;gap:2px;line-height:1.2}
      #metatake-badge .mt-b b{color:#f1f5f9}
      #metatake-badge .mt-b small{color:#9aa2af;font-weight:500;font-size:11px}
      #metatake-badge .mt-x{position:absolute;top:-8px;right:-8px;width:18px;height:18px;border-radius:50%;
        background:#2b3446;color:#cbd5e1;font-size:12px;display:flex;align-items:center;justify-content:center;
        border:1px solid rgba(255,255,255,.2)}
      #metatake-badge:hover{border-color:rgba(45,212,191,.5)}`;
    document.documentElement.appendChild(css);
    document.documentElement.appendChild(wrap);
    wrap.querySelector(".mt-x").addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation(); wrap.remove();
    });
  }
})();
