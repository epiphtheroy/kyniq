import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import SiteNav from "@/components/home2/SiteNav";
import ImportWizard from "@/components/ImportWizard";
import "./import.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Import watch history",
  description: "Bring your watched films from Letterboxd, IMDb, Netflix, Watcha, a spreadsheet, or plain text.",
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
          <Link href="/room">← My Room</Link>
        </p>
        <h1 style={{ margin: "10px 0 6px" }}>Import your watch history</h1>
        <p className="ui muted" style={{ fontSize: 14, margin: "0 0 14px", lineHeight: 1.6 }}>
          A Letterboxd export ZIP, IMDb ratings CSV, Netflix viewing history, a spreadsheet —{" "}
          or just paste a list from anywhere (Watcha included). We detect the format automatically.
        </p>
        <ol className="iw-3steps ui" aria-label="How it works">
          <li><span className="n">1</span>Export from your service</li>
          <li><span className="n">2</span>Upload it here</li>
          <li><span className="n">3</span>Your room lights up</li>
        </ol>
        <div className="iw-appsync ui">
          <p>
            <b>Web and app share one account — one history.</b> Import here and it shows in the app
            too (and the other way around).
          </p>
          <p className="s">
            Trakt · TMDB · Simkl auto-sync is in preparation — when it opens, it switches on here
            and in the app together.
          </p>
        </div>
        <ImportWizard />
      </main>
    </>
  );
}
