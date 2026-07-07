"use client";

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Link className="fbrand" href="/">
              Meta
              <br />
              take
            </Link>
            <p className="fabout">
              Read films closely — a critical map of cinema that links films through the meanings they share. The
              readings are criticism; the AI is the instrument that finds them.
            </p>
          </div>
          <div className="fcol">
            <h4>Sections</h4>
            <Link href="/film">Films</Link>
            <Link href="/director">Directors</Link>
            <Link href="/tropes">Tropes</Link>
            <Link href="/idea">Concepts</Link>
            <Link href="/lineage">Lineage</Link>
          </div>
          <div className="fcol">
            <h4>Your map</h4>
            <Link href="/room">My Room</Link>
            <Link href="/room/screener">Screener</Link>
            <Link href="/room/shelf">Shelf</Link>
            <Link href="/room/takes">My Takes</Link>
          </div>
          <div className="fcol">
            <h4>Metatake</h4>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/guidelines">Community guidelines</Link>
            <Link href="/blog">Blog</Link>
          </div>
          <div className="fcol">
            <h4>Legal</h4>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>
          </div>
        </div>
        <div className="fbar">
          <span>© 2026 Metatake. All rights reserved.</span>
          <span>Seoul, Republic of Korea</span>
          <span className="tmdb">This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        </div>
      </div>
    </footer>
  );
}
