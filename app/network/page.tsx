import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import NetworkExplorer from "@/components/NetworkExplorer";

// Static shell: NetworkExplorer is a client component that fetches its own data at
// runtime, so the page is prerendered and served from the edge.

export const metadata: Metadata = {
  // No brand suffix here — the root layout template appends "· Metatake".
  title: "Connections — films, directors & ideas, all connected",
  description: "The whole critical web of cinema — films, figures, tropes, ideas, directors and theorists, all interlinked. Click any node to dive three levels deeper.",
  alternates: { canonical: "/network" },
};

export default function NetworkPage() {
  return (
    <div className="mt">
      <SiteNav />
      <NetworkExplorer />
    </div>
  );
}
