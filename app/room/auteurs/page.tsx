import { createClient } from "@/lib/supabase/server";
import AuteursWorkspace, { type AuteurRow } from "@/components/room/AuteursWorkspace";

export const dynamic = "force-dynamic";

export default async function RoomAuteursPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_auteur_conquest", { p_limit: 40 });
  const rows = (data as AuteurRow[] | null) ?? [];
  return <AuteursWorkspace rows={rows} />;
}
