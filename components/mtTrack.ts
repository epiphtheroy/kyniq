/**
 * mtEvent(name) — count a UI interaction in first-party analytics (mt_events,
 * shown in /admin/metrics "Clicks"). Fire-and-forget, cookieless, and deduped:
 * each (page, name) sends AT MOST ONCE per page load, so high-frequency
 * gestures (map drags, zooms) measure engagement rate, not gesture spam.
 *
 * Declarative alternative: put data-mt="name" on any element — the global
 * beacon (components/Metrics.tsx) counts its clicks with no dedupe.
 */

const sent = new Set<string>();

export function mtEvent(name: string) {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("mt_optout") === "1") return;
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return;

    const key = `${location.pathname}|${name}`;
    if (sent.has(key)) return;
    sent.add(key);

    const body = JSON.stringify({
      t: "click",
      path: location.pathname,
      sid: sessionStorage.getItem("mt_sid") || "na",
      props: { name },
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/metrics", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  } catch {}
}
