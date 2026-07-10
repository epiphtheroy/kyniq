import { redirect } from "next/navigation";

// "Surprise me" was renamed to METATAKE TV and moved to /tv. Keep the old URL alive.
export default function RandomRedirect() {
  redirect("/tv");
}
