import { createClient } from "@/lib/supabase/server";
import CollectionWorkspace, { type CollRow } from "@/components/room/CollectionWorkspace";

export const dynamic = "force-dynamic";

export default async function RoomCollectionPage() {
  const supabase = await createClient();
  /* PostgREST는 RPC 응답도 1000행에서 자른다(프로젝트 실측 규칙) — 보유작이 1000편을 넘어도
     조용히 잘리지 않도록 Range 청크로 전량 수집(현재 702편 = 1회 요청). */
  const rows: CollRow[] = [];
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.rpc("me_collection").range(i * 1000, i * 1000 + 999);
    const chunk = (data as CollRow[] | null) ?? [];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return <CollectionWorkspace rows={rows} />;
}
