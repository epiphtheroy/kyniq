import Link from "next/link";
import MethodologyBadge from "./MethodologyBadge";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Byline — visible top-of-page provenance (Phase 1, 2026-07-02).
 * Complements the bottom <Provenance/>: Google's quality guidance looks for
 * "who made this, how, when" to be immediately visible, so the flagship
 * templates surface it right under the headline. Keep it one quiet line.
 *
 * `methodologyHref` deep-links the "how this is made" phrase to the most
 * relevant methodology doc (defaults to the hub). `badge` adds the small "?"
 * mark — turn it on for pages that do NOT carry the bottom <Provenance/> badge
 * (director hubs, /now, /blog), off elsewhere to avoid a duplicate mark.
 */
function fmt(d?: string | null): string | null {
  if (!d) return null;
  const t = new Date(d);
  if (isNaN(t.getTime())) return null;
  return t.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function Byline({
  updated,
  created,
  methodologyHref = "/methodology",
  badge = false,
  locale = DEFAULT_LOCALE,
}: {
  updated?: string | null;
  created?: string | null;
  methodologyHref?: string;
  badge?: boolean;
  locale?: Locale;
}) {
  const u = fmt(updated) || fmt(created);
  return (
    <p
      className="ui muted"
      style={{ fontSize: 12.5, margin: "6px 0 0", letterSpacing: 0.1 }}
    >
      {t(locale, "Drafted by")} Metatake AI · {t(locale, "to a framework by")}{" "}
      <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>
        Wonwoo Yoon
      </Link>
      {t(locale, ", who answers for it")}
      {u ? <> · {t(locale, "updated")} {u}</> : null}
      {" · "}
      <Link href={methodologyHref} className="accent" style={{ textDecoration: "none" }}>
        {t(locale, "how this is made")}
      </Link>
      {badge ? <MethodologyBadge href={methodologyHref} /> : null}
    </p>
  );
}
