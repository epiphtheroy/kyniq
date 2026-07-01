import { redirect } from "next/navigation";
// Renamed: methodology now lives at /score/about.
export default function CodexAboutRedirect() {
  redirect("/score/about");
}
