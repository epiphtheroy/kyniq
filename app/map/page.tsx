import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import MapExplorer from "@/components/MapExplorer";

export const dynamic = "force-dynamic";

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
