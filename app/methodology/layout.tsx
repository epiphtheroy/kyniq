import SiteNav from "@/components/home2/SiteNav";
import DocsTopTabs from "@/components/docs/DocsTopTabs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import "./methodology.css";

/**
 * The Method Docs shell — shared by the hub (/methodology, app/methodology/
 * page.tsx) and every doc (/methodology/[slug]). Site nav + top category strip
 * + sticky sidebar tree + article column. Canonical plan: HANDOFF-방법론-독스.md.
 */
export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt mdocs">
      <SiteNav />
      <DocsTopTabs />
      <div className="mdocs-shell">
        <DocsSidebar />
        <div className="mdocs-col">{children}</div>
      </div>
    </div>
  );
}
