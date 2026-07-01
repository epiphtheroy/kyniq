import { createClient } from "@/lib/supabase/server";
import WriteWorkspace, { type TakeRow } from "@/components/room/WriteWorkspace";
import "./write.css";

export const dynamic = "force-dynamic";

export default async function RoomWritePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("me_authored_takes");
  const takes = (data as TakeRow[] | null) ?? [];
  return <WriteWorkspace takes={takes} />;
}
