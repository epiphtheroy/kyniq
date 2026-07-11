import { permanentRedirect } from "next/navigation";

// The watch-list library moved to /watch (the main Watch landing). 308 for old links.
export default function Page() {
  permanentRedirect("/watch");
}
