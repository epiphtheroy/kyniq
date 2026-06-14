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
          <span className="logobox__line">Film</span>
          <span className="logobox__line">Curio</span>
        </Link>
        <div className="tagline" style={{ marginTop: 10 }}>
          Read films closely. One question about one film, answered in depth.
        </div>

        <div className="footer-cols">
          <div>
            <div className="footer-head">Sections</div>
            <Link href="/" className="footer-link">
              The latest
            </Link>
            <Link href="/film" className="footer-link">
              Films
            </Link>
            <Link href="/director" className="footer-link">
              Directors
            </Link>
            <Link href="/ask" className="footer-link">
              Ask a question
            </Link>
          </div>

          <div>
            <div className="footer-head">Metatake</div>
            <Link href="/about" className="footer-link">
              About
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
            <a href="mailto:channel.wonwoo@gmail.com" className="footer-link">
              channel.wonwoo@gmail.com
            </a>
          </div>
        </div>

        {/* TMDB attribution (required, SPEC §10) */}
        <p className="tmdb-note" style={{ marginTop: 22 }}>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>

        <div className="footer-baseline">
          <span>© {year} Metatake. All rights reserved.</span>
          <span>Seoul, Republic of Korea</span>
        </div>
      </div>
    </footer>
  );
}
