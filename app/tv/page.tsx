import type { Metadata } from "next";
import TVWatch from "@/components/TVWatch";
import "@/app/home2.css";

// /tv — the main METATAKE TV watch interface (player + up-next rail + the full
// "Every watch list" library). The top-nav "Metatake TV" lands here. The
// full-page channel (surprise broadcast + dossier) is at /tv/fullscreen.
const SITE = "https://metatake.net";

export const metadata: Metadata = {
  title: "Metatake TV — Watch",
  description: "Watch Metatake TV — a continuous, LLM-free video essay on cinema. Pick a watch list — a director, a canon, a trope, a concept — and leave it on. Browse the full library below.",
  alternates: { canonical: "/tv" },
  openGraph: { title: "Metatake TV — Watch", url: `${SITE}/tv`, siteName: "Metatake", type: "website" },
};

export default function Page() {
  return <TVWatch />;
}
