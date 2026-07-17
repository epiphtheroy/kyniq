// ConceptualUseNote — the "read through, not spoken by" disclaimer.
//
// Metatake reads films THROUGH a thinker's concepts; it does not report their
// opinions. A 2026-07-18 corpus measurement confirmed this is what the prose
// actually does: of ~1,227 published readings attributed to a living theorist,
// the attributive-verb rate ("X argues/claims…") was ~0 real hits — the writing
// applies a lens, it does not quote the person. This note makes that true thing
// explicit so a named thinker (or their reader) cannot mistake an applied concept
// for a statement they made about a specific film.
//
// It is true for the dead and the living alike, so it renders for every theorist
// — living-vs-deceased is not reliably derivable (Wikidata death dates are
// patchy, and not every theorist has a Wikidata match), and gating the note on a
// data field we cannot trust would drop it from exactly the people who most need
// it. Universal + always-true beats conditional + sometimes-missing.
//
// Placed under the hero dek on /theorist/[slug], /concept/[slug], /tradition/[slug].

export default function ConceptualUseNote({
  name,
  className,
}: {
  /** the thinker's name when the surface is about one person; omit on multi-thinker pages */
  name?: string | null;
  className?: string;
}) {
  const who = name ? name : "these thinkers";
  return (
    <p
      className={className}
      style={{
        margin: "10px 0 0",
        fontSize: 13.5,
        lineHeight: 1.5,
        opacity: 0.72,
        maxWidth: "62ch",
      }}
    >
      Metatake reads films <em>through</em> {who}&rsquo;s ideas — it borrows the
      lens to open a scene. Nothing here is a statement by {name ? name : "them"},
      and nothing here claims {name ? name : "they"} wrote about, or endorsed a
      reading of, any particular film. If a concept is used wrongly, that is ours
      to correct — <a href="/methodology#corrections" style={{ color: "inherit" }}>tell us</a> and
      we will fix it.
    </p>
  );
}
