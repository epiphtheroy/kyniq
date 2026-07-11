import { permanentRedirect } from "next/navigation";

// The watch interface is now the canonical /tv. 308 for old /tv/watch links.
export default function Page() {
  permanentRedirect("/tv");
}
