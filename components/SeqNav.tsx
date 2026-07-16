import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * SeqNav — a "‹ Prev · Index · Next ›" box, our take on TVTropes' bottom nav.
 * Linear/sequential browsing (vs. the associative NodeGraph below it):
 * meta-take → within its theory family (else alphabetical); figure → within
 * its film; film → within the director's filmography. Server-rendered via seq_nav().
 */

type Row = { rel: string; target: string; slug: string | null; film_slug: string | null; title: string | null };

function href(r: Row): string {
  switch (r.target) {
    case "meta_take": return `/take/${r.slug}`;
    case "figure": return `/film/${r.film_slug}/figure/${r.slug}`;
    case "film": return `/film/${r.slug}`;
    case "family": return `/meta-takes?family=${r.slug}`;
    case "metaindex": return "/meta-takes";
    case "director": return `/director/${r.slug}`;
    case "filmindex": return "/film";
    default: return "/";
  }
}

export default async function SeqNav({ kind, id, locale = DEFAULT_LOCALE }: { kind: "meta_take" | "figure" | "film"; id: string; locale?: Locale }) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await sb.rpc("seq_nav", { p_kind: kind, p_id: id });
  const rows = (data ?? []) as Row[];
  const prev = rows.find((r) => r.rel === "prev");
  const index = rows.find((r) => r.rel === "index");
  const next = rows.find((r) => r.rel === "next");
  if (!prev && !next && !index) return null;

  return (
    <nav className="seqnav" aria-label={t(locale, "Sequential navigation")}>
      <div className="seqnav-cell seqnav-prev">
        {prev ? (
          <Link href={href(prev)}>
            <span className="seqnav-dir">{t(locale, "‹ Prev")}</span>
            <span className="seqnav-ttl">{prev.title}</span>
          </Link>
        ) : <span className="seqnav-empty" aria-hidden="true" />}
      </div>
      <div className="seqnav-cell seqnav-index">
        {index ? (
          <Link href={href(index)}>
            <span className="seqnav-dir">{t(locale, "Index")}</span>
            <span className="seqnav-ttl">{index.title}</span>
          </Link>
        ) : null}
      </div>
      <div className="seqnav-cell seqnav-next">
        {next ? (
          <Link href={href(next)}>
            <span className="seqnav-dir">{t(locale, "Next ›")}</span>
            <span className="seqnav-ttl">{next.title}</span>
          </Link>
        ) : <span className="seqnav-empty" aria-hidden="true" />}
      </div>
    </nav>
  );
}
