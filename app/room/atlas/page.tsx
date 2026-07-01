import { createClient } from "@/lib/supabase/server";
import AtlasWorkspace, { type GeoData } from "@/components/room/AtlasWorkspace";
import "./atlas.css";

export const dynamic = "force-dynamic";

export default async function RoomAtlasPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_geo_coverage");
  const geo = (data as GeoData | null) ?? { points: [], by_country: [], totals: null };
  return <AtlasWorkspace data={geo} />;
}
