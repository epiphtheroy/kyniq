import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/home2/SiteNav";
import ImportWizard from "@/components/ImportWizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Import watch history — Metatake",
  description: "Bring your watched films from Letterboxd, IMDb, Watcha, Excel or plain text.",
  robots: { index: false, follow: false },
};

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login?next=/me/import");

  return (
    <>
      <SiteNav />
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 80px" }}>
        <p className="ui muted" style={{ fontSize: 13, margin: 0 }}>
          <Link href="/me">← My dashboard</Link>
        </p>
        <h1 style={{ margin: "10px 0 6px" }}>관람 기록 가져오기</h1>
        <p className="ui muted" style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
          Letterboxd 내보내기 ZIP, IMDb 평가 CSV, 엑셀/CSV, 왓챠 백업 파일 —{" "}
          또는 어디서든 복사한 텍스트를 그대로 붙여넣으세요. 형식은 자동으로 감지됩니다.
        </p>
        <ImportWizard />
      </main>
    </>
  );
}
