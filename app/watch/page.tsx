import type { Metadata } from "next";
import TVWatch from "@/components/TVWatch";
import "@/app/home2.css";

// /watch — the main Watch landing: the METATAKE TV watch interface (player +
// up-next rail + watch-list shelves). The top-nav "Watch" lands here.
const SITE = "https://metatake.net";

export const metadata: Metadata = {
  title: "Watch · METATAKE TV",
  description: "Watch METATAKE TV — a continuous, LLM-free video essay on cinema, one film and one lens at a time. Pick a watch list — a director, a canon, a trope, a concept — and leave it on.",
  alternates: { canonical: "/watch" },
  openGraph: { title: "Watch · METATAKE TV", url: `${SITE}/watch`, siteName: "Metatake", type: "website" },
};

export default function Page() {
  return <TVWatch />;
}
