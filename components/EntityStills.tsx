"use client";

// EntityStills — in-body film stills for an ENTITY page (director, genre,
// theorist, trope, concept…). Fetches a few of the entity's films' backdrops
// from /api/stills (images only — never a video) and renders them through the
// shared StillStrip lightbox. Because the stills come from the entity's member
// films (not the entity itself), disclaim=true: each caption names the topic and
// says the still is illustrative, not necessarily a scene about it.
import { useEffect, useState } from "react";
import StillStrip, { type Still } from "./StillStrip";

export default function EntityStills({
  slugs,
  topic,
  heading,
  cap = 4,
}: {
  slugs: string[];   // the entity's film slugs
  topic: string;     // the entity's name/subject, named in each caption
  heading?: string;
  cap?: number;
}) {
  const [stills, setStills] = useState<Still[]>([]);

  useEffect(() => {
    const s = slugs.filter(Boolean).slice(0, 40);
    if (!s.length) return;
    let on = true;
    fetch(`/api/stills?slugs=${encodeURIComponent(s.join(","))}&cap=${cap}`)
      .then((r) => r.json())
      .then((j) => {
        if (!on) return;
        setStills(
          ((j.stills ?? []) as { path: string; title: string | null; year: number | null; slug: string }[])
            .map((x) => ({ path: x.path, filmTitle: x.title ?? x.slug, filmYear: x.year, filmSlug: x.slug })),
        );
      })
      .catch(() => { /* no stills */ });
    return () => { on = false; };
  }, [slugs, cap]);

  if (!stills.length) return null;
  return <StillStrip stills={stills} topic={topic} heading={heading} disclaim />;
}
