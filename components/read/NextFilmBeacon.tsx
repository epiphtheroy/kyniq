"use client";
/**
 * NextFilmBeacon — counts ONE impression per page for the NextFilm block, so the
 * click events it carries (`next:<surface>:<pos>`, emitted declaratively by
 * data-mt) have a denominator. Renders nothing; mount-only, fire-and-forget.
 *
 * Deliberately tiny and client-only: NextFilm itself stays a server component so
 * its links are in the server HTML and crawlers follow them.
 */
import { useEffect } from "react";
import { mtEvent } from "@/components/mtTrack";

export default function NextFilmBeacon({ surface }: { surface: string }) {
  useEffect(() => { mtEvent(`next_shown:${surface}`); }, [surface]);
  return null;
}
