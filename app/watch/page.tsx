import { permanentRedirect } from "next/navigation";

// The main watch interface lives at /tv now. 308 for old /watch links.
export default function Page() {
  permanentRedirect("/tv");
}
