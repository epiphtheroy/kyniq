import SiteNav from "@/components/home2/SiteNav";
import PoeTopTabs from "@/components/poetics/PoeTopTabs";
import PoeSidebar from "@/components/poetics/PoeSidebar";
import "./poetics.css";

/**
 * Poetics shell — the critical-essay corner. Site nav + top category strip +
 * sticky sidebar tree + article column. Shared by the hub (/poetics) and every
 * essay (/poetics/[slug]). Canonical plan: HANDOFF-포에틱스-비평에세이.md.
 */
export default function PoeticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt poe">
      <SiteNav />
      <PoeTopTabs />
      <div className="poe-shell">
        <PoeSidebar />
        <div className="poe-col">{children}</div>
      </div>
    </div>
  );
}
