import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-cols">
        {/* Column 1: Brand */}
        <div>
          <Link href="/" className="brandlock" aria-label="FilmCurio home">
            <Image
              src="/mark.svg"
              alt=""
              width={24}
              height={24}
              style={{ height: 24, width: 24, marginRight: 6 }}
            />
            <picture>
              <source
                srcSet="/wordmark-dark.svg"
                media="(prefers-color-scheme: dark)"
              />
              <Image
                src="/wordmark.svg"
                alt="FilmCurio"
                width={72}
                height={18}
                style={{ height: 18, width: "auto" }}
              />
            </picture>
          </Link>
          <div className="seclbl" style={{ marginTop: 10 }}>
            FILM Q&amp;A COMMUNITY
          </div>
          <div className="tagline" style={{ marginTop: 4 }}>
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
          <div className="footer-link">FilmCurio</div>
          <div className="footer-link">Seoul, Republic of Korea</div>
          <a href="mailto:channel.wonwoo@gmail.com" className="footer-link">
            channel.wonwoo@gmail.com
          </a>
        </div>
      </div>

      {/* TMDB attribution (required, SPEC §10) */}
      <p className="tmdb-note" style={{ marginTop: 20 }}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>

      {/* Baseline */}
      <div className="footer-baseline">
        <span>© {year} FilmCurio. All rights reserved.</span>
        <span>English ▾</span>
      </div>
    </footer>
  );
}
