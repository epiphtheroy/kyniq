import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-cols">
        {/* Column 1: Brand */}
        <div>
          <Link href="/" className="logo" aria-label="Kyniq home">
            <picture>
              <source
                srcSet="/kyniq-wordmark-dark.svg"
                media="(prefers-color-scheme: dark)"
              />
              <Image
                src="/kyniq-wordmark.svg"
                alt="Kyniq"
                width={72}
                height={24}
                style={{ height: 24, width: "auto" }}
              />
            </picture>
          </Link>
          <div className="tagline" style={{ marginTop: 8 }}>
            Read films closely.
          </div>
        </div>

        {/* Column 2: Links */}
        <div>
          <Link href="/about" className="footer-link">
            About
          </Link>
          <Link href="/contact" className="footer-link">
            Contact
          </Link>
          <Link href="/guidelines" className="footer-link">
            Community guidelines
          </Link>
          <Link href="/terms" className="footer-link">
            Terms
          </Link>
          <Link href="/privacy" className="footer-link">
            Privacy
          </Link>
        </div>

        {/* Column 3: Company */}
        <div>
          <div className="footer-link">Kyniq</div>
          <div className="footer-link">Seoul, Republic of Korea</div>
          <a href="mailto:contact.kyniq@gmail.com" className="footer-link">
            contact.kyniq@gmail.com
          </a>
        </div>
      </div>

      {/* TMDB attribution (required, SPEC §10) */}
      <p className="tmdb-note" style={{ marginTop: 20 }}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>

      {/* Baseline */}
      <div className="footer-baseline">
        <span>© {year} Kyniq. All rights reserved.</span>
        <span>English ▾</span>
      </div>
    </footer>
  );
}
