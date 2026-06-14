import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Metatake",
  description: "Read films closely — and follow the meanings from one film to the next.",
};

export default function AboutPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>About Metatake</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "60ch" }}>
        Read films closely — and follow the meanings from one film to the next.
      </p>

      <hr className="rule" />

      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake breaks a film into its <em>figures</em> — a character, an object, a gesture, a shot,
        a piece of music — and gives each one critical <em>readings</em>. When a reading recurs across
        many films, it rises into a <em>meta-take</em>: a hub that gathers films you would never have
        placed side by side. The result is less a database than a critical map of cinema: surfaces far
        apart, meanings close together. You enter through a film you love and leave having met its
        unexpected kin.
      </p>

      <hr className="rule" />

      <div className="seclbl">The name</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        A <em>take</em> is one interpretation of a single moment. A{" "}
        <span className="disp" style={{ fontSize: 18 }}>meta-take</span> is the reading above the
        readings — the concept that connects them across films. That hub is the protagonist of the
        site, and it is where the rabbit hole begins.
      </p>

      <hr className="rule" />

      <div className="seclbl">How films connect</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Each figure is read through several critical registers — formal, mythic, political, existential,
        and more — so the same object opens onto different meanings. Those readings are the links: a
        figure points to the meta-takes it embodies, and each meta-take gathers the figures, across
        many films, that share it. Follow a reading and you cross from one film to the next, guided not
        by genre or era but by meaning. The connections we prize are the unexpected-but-defensible
        ones — far apart on the surface, family underneath.
      </p>

      <hr className="rule" />

      <div className="seclbl">How our readings are written</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        We want to be straight with you. The readings are written by{" "}
        <span className="disp" style={{ fontSize: 18 }}>Metatake Editorial</span>, an AI system built
        for close film analysis, and some are anchored to published film scholarship. It is published
        directly — there is no separate human or second-model sign-off before a reading goes up. Instead
        we audit pages on an ongoing basis and revise them as readers, and our own spot-checks, surface
        mistakes. Logged-in readers can add their own takes beneath any figure; there are no wrong
        readings here, and no downvotes. Film stills and clips are attached with images from TMDB.
        Spot something off? Corrections are welcome at the address below.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who&apos;s behind it</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is an independent project based in Seoul, Republic of Korea. It&apos;s small and built
        in the open; the quickest way to reach a human is email.
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 13 }}>
        Questions, press, or partnerships:{" "}
        <a href="mailto:channel.wonwoo@gmail.com" className="accent" style={{ textDecoration: "none" }}>
          channel.wonwoo@gmail.com
        </a>
      </p>
    </main>
  );
}
