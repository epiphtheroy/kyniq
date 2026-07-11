import { permanentRedirect } from "next/navigation";

/**
 * /atlas → /locations (terminology cleanup 2026-07-11, user decision: the
 * geographic map is named "Locations" everywhere now — the word "Atlas" was
 * confusable with the /network connection graph across tabs). 308 so the ~73
 * country hubs + the /atlas landing already in the sitemap/IndexNow transfer.
 */
export default function OldAtlasRedirect() {
  permanentRedirect("/locations");
}
