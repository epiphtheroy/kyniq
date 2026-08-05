/** Never let a failed query look like an absent row.
 *
 * PostgREST returns `{ data: null, error }` for a timeout and `{ data: null,
 * error: null }` for a row that genuinely is not there. Loaders that read only
 * `data` collapse the two, so a database under load starts answering "no such
 * film" — and because notFound() renders a 404, ISR caches that answer. On
 * 2026-08-06 real films, Parasite among them, served 404 to crawlers for the
 * rest of the revalidate window after the saturation had already passed. A 404
 * tells a crawler to drop the URL; a 500 tells it to come back.
 *
 * So: throw on error, and only return null when the row is really missing.
 *
 *   const film = rowOrThrow(
 *     await supabase.from("films").select("…").eq("slug", slug).maybeSingle(),
 *   );
 *   if (!film) return null;   // genuinely absent → a legitimate 404
 */
export function rowOrThrow<T>(res: { data: T; error: unknown | null }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Same guard for list queries, where the empty case is `[]` rather than null. */
export function rowsOrThrow<T>(res: { data: T[] | null; error: unknown | null }): T[] {
  if (res.error) throw res.error;
  return res.data ?? [];
}
