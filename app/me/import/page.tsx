import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/home2/SiteNav";
import ImportWizard from "@/components/ImportWizard";
import "./import.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Import watch history — Metatake",
  description: "Bring your watched films from Letterboxd, IMDb, Trakt, a spreadsheet, or plain text.",
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
          <Link href="/me">← My Room</Link>
        </p>
        <h1 style={{ margin: "10px 0 6px" }}>Import your watch history</h1>
        <p className="ui muted" style={{ fontSize: 14, margin: "0 0 20px", lineHeight: 1.6 }}>
          A Letterboxd export ZIP, IMDb ratings CSV, a Trakt or spreadsheet file —{" "}
          or just paste a list from anywhere. We detect the format automatically.
        </p>
        <ImportWizard />
      </main>
    </>
  );
}
