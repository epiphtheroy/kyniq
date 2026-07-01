import { createClient } from "@/lib/supabase/server";
import LibraryWorkspace, { type LibRow } from "@/components/room/LibraryWorkspace";
import "./library.css";

export const dynamic = "force-dynamic";

export default async function RoomLibraryPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_library");
  const rows = (data as LibRow[] | null) ?? [];
  return <LibraryWorkspace rows={rows} />;
}
