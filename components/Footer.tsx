import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* Brand block — red box wordmark + motto */}
        <Link
          href="/"
          className="logobox"
          aria-label="Metatake home"
          style={{ padding: "7px 10px 8px" }}
        >
          <span className="logobox__line">Meta</span>
          <span className="logobox__line">take</span>
        </Link>
        <div className="tagline" style={{ marginTop: 10 }}>
          Read films closely — a critical map of cinema that links films through the meanings they share.
        </div>

        <div className="footer-cols">
          <div>
            <div className="footer-head">Sections</div>
            <Link href="/film" className="footer-link">
              Films
            </Link>
            <Link href="/director" className="footer-link">
              Directors
            </Link>
            <Link href="/tropes" className="footer-link">
              Tropes
            </Link>
            <Link href="/concept" className="footer-link">
              Concepts
            </Link>
          </div>

          <div>
            <div className="footer-head">Metatake</div>
            <Link href="/about" className="footer-link">
              About
            </Link>
            <Link href="/methodology" className="footer-link">
              Methodology
            </Link>
            <Link href="/mcp" className="footer-link">
              MCP for AI
            </Link>
            <Link href="/api" className="footer-link">
              API &amp; embeds
            </Link>
            <Link href="/contact" className="footer-link">
              Contact
            </Link>
            <Link href="/guidelines" className="footer-link">
              Community guidelines
            </Link>
          </div>

          <div>
            <div className="footer-head">Legal</div>
            <Link href="/terms" className="footer-link">
              Terms
            </Link>
            <Link href="/privacy" className="footer-link">
              Privacy
            </Link>
            <a href="mailto:wonwoo@metatake.net" className="footer-link">
              wonwoo@metatake.net
            </a>
          </div>
        </div>

        {/* TMDB attribution (required, SPEC §10) */}
        <p className="tmdb-note" style={{ marginTop: 22 }}>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>

        {/* Content licence — Metatake's own criticism is free to reuse WITH
            attribution, non-commercially. Stamped site-wide so the terms travel
            with anything copied (incl. the AI context packs). */}
        <p className="tmdb-note" style={{ marginTop: 8 }}>
          Metatake&rsquo;s original writing — readings, TakeScores, and essays — is licensed{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc/4.0/"
            target="_blank"
            rel="license noopener noreferrer"
            className="footer-link"
            style={{ display: "inline", padding: 0 }}
          >
            CC BY-NC 4.0
          </a>
          : quote and reuse it freely with attribution to Metatake and a link back; not for commercial use.
        </p>

        <div className="footer-baseline">
          <span>© {year} Metatake. All rights reserved.</span>
          <span>Seoul, Republic of Korea</span>
        </div>
      </div>
    </footer>
  );
}
