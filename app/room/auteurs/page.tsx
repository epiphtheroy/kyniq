import "./auteurs.css";
import { createClient } from "@/lib/supabase/server";
import AuteursWorkspace, { type AuteurRow } from "@/components/room/AuteursWorkspace";
import { STR } from "@/components/room/strings";

export const dynamic = "force-dynamic";

export default async function RoomAuteursPage() {
  const supabase = await createClient();
  /* me_auteur_conquest returns a single json array (cap-safe — not subject to the
     PostgREST 1000-row cap). v3 widens the window to 80 directors; the workspace
     renders the first 30 with a "Show all" reveal (spec §3.8.5). */
  const { data, error } = await supabase.rpc("me_auteur_conquest", { p_limit: 80 });
  if (error) {
    return (
      <div className="mainpad">
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }
  const rows = (data as AuteurRow[] | null) ?? [];
  return <AuteursWorkspace rows={rows} />;
}
