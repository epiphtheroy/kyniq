import { permanentRedirect } from "next/navigation";

/**
 * /blog/curious → /curious (section split out of the blog 2026-07-07, user
 * decision). 308 so indexed/shared URLs transfer cleanly — same pattern as
 * /film/[slug]/honors.
 */
export default function OldCuriousRedirect() {
  permanentRedirect("/curious");
}
