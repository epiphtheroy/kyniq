import { redirect } from "next/navigation";
// Renamed: TakeScore now lives at /takescore.
export default function ScoreRedirect() {
  redirect("/takescore");
}
