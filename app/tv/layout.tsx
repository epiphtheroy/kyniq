import type { Metadata } from "next";

// No canonical here: a layout-level canonical:"/tv" leaks to every child route
// (e.g. /tv/full). Each child owns its own canonical; /tv sets it in page.tsx.
export const metadata: Metadata = {
  title: { absolute: "METATAKE TV — the channel that never stops reading films" },
  description:
    "A film-criticism channel: one film, one lens at a time — strong misreadings, what critics said, the connections, the locations, the canon. Leave it on.",
};

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return children;
}
