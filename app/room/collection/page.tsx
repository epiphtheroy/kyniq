import { createClient } from "@/lib/supabase/server";
import CollectionWorkspace, { type CollRow } from "@/components/room/CollectionWorkspace";

export const dynamic = "force-dynamic";

export default async function RoomCollectionPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_collection");
  const rows = (data as CollRow[] | null) ?? [];
  return <CollectionWorkspace rows={rows} />;
}
