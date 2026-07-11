import { permanentRedirect } from "next/navigation";

/**
 * /map → /network (terminology cleanup 2026-07-11, user decision: the connection
 * graph is "/network"; the word "map" was confusable with the geographic
 * /locations map across tabs). 308 and QUERY-PRESERVING — DB-emitted deep links
 * (/map?m=critical&t=film&k=… from surprise/TV cards) and any external links
 * transfer intact. The /api/map endpoint keeps its name (DB emits it too).
 */
export default async function OldMapRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v != null) qs.set(k, v);
  }
  const q = qs.toString();
  permanentRedirect(q ? `/network?${q}` : "/network");
}
