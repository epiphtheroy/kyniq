import type { Metadata } from "next";
import TVChannel from "@/components/TVChannel";
import "@/app/home2.css";

// /tv/fullscreen — the full-page METATAKE TV channel (was /tv). The main watch
// interface (player + watch-list library) is at /tv.
export const metadata: Metadata = {
  title: "METATAKE TV — the channel",
  description: "METATAKE TV, full page — a continuous, LLM-free broadcast that never stops reading films, one film and one lens at a time.",
  alternates: { canonical: "/tv/fullscreen" },
};

export default function Page() {
  return <TVChannel />;
}
