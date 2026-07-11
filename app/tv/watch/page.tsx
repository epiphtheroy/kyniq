import type { Metadata } from "next";
import TVWatch from "@/components/TVWatch";
import "@/app/home2.css";

// /tv/watch — alias of the main watch interface, which now lives at /watch.
// Kept so existing /tv/watch?list=…/?v=… links still play; canonical → /watch.
export const metadata: Metadata = {
  title: "Watch · METATAKE TV",
  alternates: { canonical: "/watch" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <TVWatch />;
}
