import type { Metadata } from "next";
import TVChannel from "@/components/TVChannel";
import "@/app/home2.css";

// /tv/fullscreen — METATAKE TV "On Air": the always-on broadcast. Nothing to
// pick, no host, no menu — films and their readings play back to back forever.
// The interactive watch interface (playlists + library) is at /tv.
export const metadata: Metadata = {
  title: "METATAKE TV — On Air",
  description: "The always-on broadcast: films and their readings, back to back, forever. No host, no menu, nothing to pick — just leave it on.",
  alternates: { canonical: "/tv/fullscreen" },
};

export default function Page() {
  return <TVChannel />;
}
