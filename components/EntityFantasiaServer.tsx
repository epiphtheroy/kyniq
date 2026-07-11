// EntityFantasiaServer — async server wrapper: loads the entity's fantasia rows
// and renders the client module. Fails soft (null) so an RPC hiccup never 500s
// the host page; the unstable_cache inside loadFantasia still refuses to cache
// errors (null-poison guard), so the next request retries.
import EntityFantasia, { type FantasiaRow } from "@/components/EntityFantasia";
import { loadFantasia } from "@/lib/fantasia";

export default async function EntityFantasiaServer({ type, entityKey, key2, title, sectionId, sectionClass, selfHref, tag }: {
  type: string; entityKey: string; key2?: string | null; title: string;
  sectionId?: string; sectionClass?: string; selfHref?: string | null; tag?: string;
}) {
  let rows: FantasiaRow[] = [];
  try {
    rows = await loadFantasia(type, entityKey, key2, tag);
  } catch {
    return null;
  }
  return <EntityFantasia title={title} rows={rows} sectionId={sectionId} sectionClass={sectionClass} selfHref={selfHref} />;
}
