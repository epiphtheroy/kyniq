import { Suspense } from "react";
import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import CreditsExplorer from "./CreditsExplorer";
import "./credits.css";

export const metadata: Metadata = {
  title: "Credits — follow the credits | Metatake",
  description:
    "Every film is signed by more than its director. Follow the cinematographer, editor, composer or designer of a film you loved through their whole body of work — where to begin, the essentials, the deep cuts, and the repertory company they keep.",
  alternates: { canonical: "/credits" },
};

export default function CreditsPage() {
  return (
    <div className="mt">
      <SiteNav />
      <Suspense fallback={<div style={{ padding: "48px 24px", color: "#6B6B6B" }}>Loading…</div>}>
        <CreditsExplorer />
      </Suspense>
    </div>
  );
}
