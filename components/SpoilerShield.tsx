"use client";

/**
 * SpoilerShield — wraps the canonical answer on the question page.
 *
 * - spoiler_level "major": banner ("goes all the way to the end") +
 *   the body is CSS-blurred behind a reveal button. The full text is
 *   always in the SSR HTML — the veil is presentation only, so SEO /
 *   AI-citation reads the complete answer.
 * - "mild": banner only, no blur.
 * - "none" or null (legacy rows): children rendered untouched.
 *
 * See spoiler-guard-design.md.
 */

import { useState, type ReactNode } from "react";

interface Props {
  level: string | null;
  children: ReactNode;
}

export default function SpoilerShield({ level, children }: Props) {
  const [revealed, setRevealed] = useState(false);

  if (level !== "major" && level !== "mild") return <>{children}</>;

  const major = level === "major";
  const hidden = major && !revealed;

  return (
    <>
      <div className="spoiler-banner" role="note">
        <span aria-hidden="true">🎬</span>
        <span className="spoiler-banner__label">
          {major
            ? "Spoiler zone — this reading goes all the way to the end."
            : "Mild spoilers — mid-film details ahead."}
        </span>
        {hidden && (
          <button
            type="button"
            className="spoiler-banner__btn"
            aria-expanded={revealed}
            onClick={() => setRevealed(true)}
          >
            Reveal the answer
          </button>
        )}
      </div>
      <div
        className={`spoiler-veil${hidden ? " spoiler-veil--hidden" : ""}`}
        aria-hidden={hidden}
      >
        {children}
      </div>
    </>
  );
}
