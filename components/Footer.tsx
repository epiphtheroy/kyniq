"use client";

import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { t } from "@/lib/i18n";
import { BrandStack } from "@/components/Brand";

/** Site footer. Client so it can read the locale from the path (it renders in the
 *  root layout, outside {children}, so no provider prop reaches it). Labels project
 *  through t(); brand marks (Metatake, TakeScore, MCP, API) stay English. On the
 *  English site every t() returns the original, so it is byte-identical. */
export default function Footer() {
  const year = new Date().getFullYear();
  const locale = useLocale();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {/* Brand block — the stacked wordmark + motto */}
        <Link href="/" className="brandlink" aria-label="Metatake home">
          <BrandStack height={80} label="" />
        </Link>
        <div className="tagline" style={{ marginTop: 10 }}>
          {t(locale, "Read films closely — a critical map of cinema that links films through the meanings they share.")}
        </div>

        <div className="footer-cols">
          <div>
            <div className="footer-head">{t(locale, "Sections")}</div>
            <Link href="/film" className="footer-link">{t(locale, "Films")}</Link>
            <Link href="/director" className="footer-link">{t(locale, "Directors")}</Link>
            <Link href="/tropes" className="footer-link">{t(locale, "Tropes")}</Link>
            <Link href="/concept" className="footer-link">{t(locale, "Concepts")}</Link>
            <Link href="/lineage" className="footer-link">{t(locale, "Lineage")}</Link>
          </div>

          <div>
            <div className="footer-head">{t(locale, "For AI & developers")}</div>
            <Link href="/mcp" className="footer-link">{t(locale, "MCP for AI")}</Link>
            <Link href="/api" className="footer-link">{t(locale, "API & embeds")}</Link>
            <Link href="/data" className="footer-link">{t(locale, "Open data")}</Link>
            <Link href="/partners" className="footer-link">{t(locale, "Partner with us")}</Link>
            <Link href="/methodology" className="footer-link">{t(locale, "Methodology")}</Link>
          </div>

          <div>
            <div className="footer-head">Metatake</div>
            <Link href="/about" className="footer-link">{t(locale, "About")}</Link>
            <Link href="/app" className="footer-link">{t(locale, "Get the app")}</Link>
            <Link href="/updates" className="footer-link">{t(locale, "Updates")}</Link>
            <Link href="/blog" className="footer-link">{t(locale, "The Daily")}</Link>
            <Link href="/curious" className="footer-link">Curious</Link>
            <Link href="/contact" className="footer-link">{t(locale, "Contact")}</Link>
            <Link href="/guidelines" className="footer-link">{t(locale, "Community guidelines")}</Link>
          </div>

          <div>
            <div className="footer-head">{t(locale, "Legal")}</div>
            <Link href="/terms" className="footer-link">{t(locale, "Terms")}</Link>
            <Link href="/privacy" className="footer-link">{t(locale, "Privacy")}</Link>
            <a href="mailto:wonwoo@metatake.net" className="footer-link">
              wonwoo@metatake.net
            </a>
          </div>
        </div>

        {/* Newsletter capture — calm, compact; persistent chrome, not a hero */}
        <div
          style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--hairline)", maxWidth: 440 }}
        >
          <div className="footer-head" style={{ marginBottom: 8 }}>
            {t(locale, "The Metatake Read — one film, read closely. Free.")}
          </div>
          <SubscribeForm source="footer" button="Subscribe" />
        </div>

        {/* TMDB attribution (required, SPEC §10) */}
        <p className="tmdb-note" style={{ marginTop: 22 }}>
          {t(locale, "This product uses the TMDB API but is not endorsed or certified by TMDB.")}
        </p>

        {/* Content licence — Metatake's own criticism is free to reuse WITH
            attribution, non-commercially. Stamped site-wide so the terms travel
            with anything copied (incl. the AI context packs). */}
        <p className="tmdb-note" style={{ marginTop: 8 }}>
          {t(locale, "Metatake's original writing — readings, TakeScores, and essays — is licensed")}{" "}
          <a
            href="https://creativecommons.org/licenses/by-nc/4.0/"
            target="_blank"
            rel="license noopener noreferrer"
            className="footer-link"
            style={{ display: "inline", padding: 0 }}
          >
            CC BY-NC 4.0
          </a>
          {t(locale, ": quote and reuse it freely with attribution to Metatake and a link back; not for commercial use.")}
        </p>

        <div className="footer-baseline">
          <span>© {year} Metatake. {t(locale, "All rights reserved.")}</span>
          <span>{t(locale, "Seoul, Republic of Korea")}</span>
        </div>
      </div>
    </footer>
  );
}
