"use client";

/**
 * First-party analytics beacon — the collection half of /admin/metrics.
 *
 * Sends small JSON events to /api/metrics (stored in Supabase mt_events):
 *  - pageview  on load + every App Router navigation
 *  - leave     when a page is left (dwell_ms + max scroll_pct) — sendBeacon,
 *              so it survives tab close
 *  - click     on any element carrying data-mt="name" + outbound links
 *  - vital     LCP/CLS/INP/TTFB, sampled per session (1 in 3)
 *
 * Privacy: no cookies, no persistent id. The visitor hash is computed
 * server-side from (day, ip, ua, salt) and rotates daily; the session id
 * lives in sessionStorage only. Opt out: localStorage.mt_optout = "1"
 * (toggle on /admin/metrics).
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

const EP = "/api/metrics";
const VITALS = new Set(["LCP", "CLS", "INP", "TTFB"]);

function optedOut(): boolean {
  try {
    if (localStorage.getItem("mt_optout") === "1") return true;
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function sid(): string {
  try {
    let s = sessionStorage.getItem("mt_sid");
    if (!s) {
      s = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("mt_sid", s);
    }
    return s;
  } catch {
    return "na";
  }
}

function send(payload: Record<string, unknown>, beacon = false) {
  if (optedOut()) return;
  try {
    const body = JSON.stringify({ ...payload, sid: sid() });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(EP, new Blob([body], { type: "application/json" }));
    } else {
      fetch(EP, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
  } catch {}
}

export default function Metrics() {
  const pathname = usePathname();
  const cur = useRef<string | null>(null);
  const since = useRef(0);
  const maxScroll = useRef(0);
  const leftSent = useRef(false);
  const firstLoad = useRef(true);
  // sample web vitals 1 session in 3 (they'd otherwise double event volume)
  const vitalsOn = useRef(false);

  useReportWebVitals((m) => {
    if (!vitalsOn.current || !VITALS.has(m.name)) return;
    send({ t: "vital", path: cur.current ?? location.pathname, props: { name: m.name, value: m.value } });
  });

  // pageview + leave around every route change
  useEffect(() => {
    if (!pathname) return;

    if (cur.current && cur.current !== pathname) flushLeave();

    cur.current = pathname;
    since.current = Date.now();
    maxScroll.current = 0;
    leftSent.current = false;

    const sp = new URLSearchParams(location.search);
    send({
      t: "pageview",
      path: pathname,
      ref: firstLoad.current ? document.referrer || "" : "",
      utm_source: sp.get("utm_source") || undefined,
      utm_medium: sp.get("utm_medium") || undefined,
      utm_campaign: sp.get("utm_campaign") || undefined,
      sw: window.screen?.width,
      lang: navigator.language,
    });
    firstLoad.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    try {
      vitalsOn.current = Math.random() < 1 / 3;
    } catch {}

    const onScroll = () => {
      const doc = document.documentElement;
      const h = doc.scrollHeight || 1;
      const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / h) * 100));
      if (pct > maxScroll.current) maxScroll.current = pct;
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") flushLeave();
      else leftSent.current = false; // came back — allow another leave later
    };

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-mt], a[href]");
      if (!el) return;
      const name = (el as HTMLElement).dataset?.mt;
      if (name) {
        send({ t: "click", path: cur.current ?? location.pathname, props: { name } });
        return;
      }
      const href = (el as HTMLAnchorElement).href;
      if (href && /^https?:/.test(href)) {
        try {
          const u = new URL(href);
          if (u.hostname !== location.hostname) {
            send({ t: "click", path: cur.current ?? location.pathname, props: { name: "outbound", href: u.hostname + u.pathname } }, true);
          }
        } catch {}
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushLeave);
    document.addEventListener("click", onClick, true);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  function flushLeave() {
    if (leftSent.current || !cur.current) return;
    leftSent.current = true;
    send(
      {
        t: "leave",
        path: cur.current,
        props: { dwell_ms: Date.now() - since.current, scroll_pct: maxScroll.current },
      },
      true
    );
  }

  return null;
}
