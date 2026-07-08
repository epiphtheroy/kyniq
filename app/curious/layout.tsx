import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { DESKS, DESK_KEYS } from "@/lib/desks";
import { CuriousSearchBar } from "@/components/curious/ui";
import "./curious.css";

/**
 * Curious section shell — ScreenRant-style masthead shared by /curious,
 * /curious/[desk] and /curious/search: wordmark, an always-visible search
 * bar (plain GET form → /curious/search), and the desk strip.
 */
export default function CuriousLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt cur">
      <SiteNav />
      <div className="cur-mast">
        <div className="cur-mast__row">
          <Link className="cur-brand" href="/curious">
            <span className="cur-brand__mark">Curious<span className="q">?</span></span>
            <span className="cur-brand__tag">The Metatake question desk</span>
          </Link>
          <CuriousSearchBar />
          <Link className="cur-mast__daily" href="/blog">Between Film and the World ↗</Link>
        </div>
        <nav className="cur-strip" aria-label="Curious desks">
          <div className="cur-strip__in">
            <Link href="/curious">All</Link>
            {DESK_KEYS.map((k) => (
              <span key={k} style={{ display: "contents" }}>
                <span className="d" />
                <Link href={`/curious/${k}`}>{DESKS[k].label}</Link>
              </span>
            ))}
            <span className="d" />
            <Link href="/curious/misreadings">Misreadings</Link>
            <span className="d" />
            <Link href="/curious/locations">On Location</Link>
            <span className="d" />
            <Link href="/curious/directors">Directors</Link>
          </div>
        </nav>
      </div>
      {children}
    </div>
  );
}
