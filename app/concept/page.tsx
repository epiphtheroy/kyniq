import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const revalidate = 600;
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export const metadata: Metadata = {
  title: "Critical concepts in film — meaning & examples",
  description: "Recurring critical ideas in cinema — the uncanny, the gaze, commodity fetishism, unreliable narration and more — each with the films and readings that embody it.",
  openGraph: { title: "Critical concepts in film — meaning & examples", description: "Recurring critical ideas in cinema, each with the films that embody it." },
  robots: pageRobots(true),
};

export default async function ConceptIndex() {
  const { data } = await db().rpc("concept_index");
  const items = (data ?? []) as { slug: string; title: string; n: number }[];
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <h1 className="mt-h1">Concepts in film</h1>
        <p className="mt-laconic">
          Recurring critical ideas across cinema — each gathering the films and readings that embody it. The vocabulary critics actually use, mapped onto the movies that show it.
        </p>
        {items.length === 0 ? (
          <p className="mt-see" style={{ fontStyle: "italic" }}>No concepts yet.</p>
        ) : (
          <ul className="mt-cols">
            {items.map((c) => (
              <li key={c.slug}>
                <Link href={`/concept/${c.slug}`}>{c.title} in film</Link>{" "}
                <span className="yr">({c.n})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
