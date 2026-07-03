import { permanentRedirect } from "next/navigation";
// Renamed: TakeScore now lives at /takescore.
export default function ScoreRedirect() {
  permanentRedirect("/takescore");
}
