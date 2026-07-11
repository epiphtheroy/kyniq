import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METATAKE TV — the channel that never stops reading films",
  description:
    "A film-criticism channel: one film, one lens at a time — strong misreadings, what critics said, the connections, the locations, the canon. Leave it on.",
  alternates: { canonical: "/tv" },
};

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return children;
}
