import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import MapExplorer from "@/components/MapExplorer";

// Static shell: MapExplorer is a client component that fetches its own data at
// runtime, so the page is prerendered and served from the edge.

export const metadata: Metadata = {
  title: "The Map — Metatake",
  description: "The whole critical web of cinema — films, figures, tropes, ideas, directors and theorists, all interlinked. Click any node to dive three levels deeper.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <div className="mt">
      <SiteNav />
      <MapExplorer />
    </div>
  );
}
