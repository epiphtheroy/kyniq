import { permanentRedirect } from "next/navigation";

/** Legacy URL — the where-to-watch guide moved to /whereto/{slug}. 308 for old links. */

interface Props { params: Promise<{ slug: string }>; }

export default async function FilmWatchRedirect({ params }: Props) {
  const { slug } = await params;
  permanentRedirect(`/whereto/${slug}`);
}
