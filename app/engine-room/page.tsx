import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";
import { DESKS, DESK_KEYS } from "@/lib/desks";

export const revalidate = 3600;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const loadStats = unstable_cache(
  async () => {
    const supabase = db();
    const stats: Record<string, number> = {};
    let films = 0;
    await Promise.all([
      ...DESK_KEYS.map(async (k) => {
        const { count } = await supabase
          .from("essays")
          .select("id", { count: "exact", head: true })
          .eq("mode", DESKS[k].mode)
          .eq("lang", "en")
          .eq("status", "verified");
        stats[k] = count ?? 0;
      }),
      (async () => {
        const { count } = await supabase
          .from("films")
          .select("id", { count: "exact", head: true })
          .eq("visible", true)
          .eq("is_analyzed", true);
        films = count ?? 0;
      })(),
    ]);
    return { stats, films };
  },
  ["engine-room-stats-1"],
  { revalidate: 3600 }
);

export async function generateMetadata(): Promise<Metadata> {
  const title = "The Engine Room — How Metatake's Desks Work";
  const description =
    "Nine editorial desks, one commissioning system, adversarial fact-checking, and a public kill rate. How Metatake produces and verifies its film essays.";
  return {
    title,
    description,
    alternates: { canonical: "/engine-room" },
    openGraph: { title, description },
    robots: pageRobots(true),
  };
}

export default async function EngineRoomPage() {
  const { stats, films } = await loadStats();
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap" style={{ maxWidth: 760, padding: "28px 20px 60px" }}>
        <div className="df-crumb">
          <Link href="/">Home</Link>
          <span className="df-sep">›</span>
          <span>The Engine Room</span>
        </div>

        <article className="essay">
          <h1 className="essay-h1">The Engine Room</h1>
          <p className="essay-dek">
            Nine editorial desks. Every essay commissioned, written against a
            fixed contract, adversarially fact-checked, and killed without
            appeal when it fails. This page is the machine, shown openly.
          </p>

          <div className="essay-body">
            <p>
              Metatake&rsquo;s film pages carry essays produced by a system we
              call the Engine Room. It works like an old-fashioned editorial
              floor with modern machinery: an assignment desk reads every film
              in the catalog ({films.toLocaleString()} analyzed titles) and
              commissions only the pieces it believes a film can genuinely
              sustain — no desk fills a quota. Writers (frontier language
              models, named on every essay&rsquo;s plaque) file against a
              strict output contract. Independent verifiers with live web
              access then attack each draft: misattributed concepts, invented
              terminology, on-screen errors, and unsupported claims are hard
              failures. A failed essay gets at most two rewrites; if it still
              fails, it is killed and the film simply doesn&rsquo;t get that
              essay.
            </p>
            <p>
              We publish what survives. Every essay carries its verification
              date and engine name. The prose is never edited after
              verification — what you read is what passed.
            </p>

            <h2>The desks</h2>
            <ul>
              {DESK_KEYS.map((k) => (
                <li key={k}>
                  <strong>{DESKS[k].deskName}</strong> — {DESKS[k].blurb}
                  {stats[k] > 0 && (
                    <>
                      {" "}
                      <span style={{ color: "var(--muted)" }}>
                        ({stats[k].toLocaleString()} published)
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p>
              {total.toLocaleString()} essays are live in English, most with
              Korean editions. Desks that commission sparingly do so by design:
              a fan-theory essay requires theories that actually circulate; an
              exegesis requires a film that can hold one.
            </p>

            <h2>What gets an essay killed</h2>
            <ul>
              <li>A concept attributed to the wrong theorist, or a term the theorist never coined.</li>
              <li>A claim about what happens on screen that is wrong.</li>
              <li>Real-world claims that cannot be sourced.</li>
              <li>Padding, listicle filler, or breaking the desk&rsquo;s brief.</li>
            </ul>
            <p>
              Kill decisions are final for that round. Roughly one essay in
              five fails its first verification; most are recovered on
              rewrite, and the rest are dropped.
            </p>

            <p>
              Full methodology, including the verification protocol:{" "}
              <Link href="/methodology">metatake.net/methodology</Link>.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
