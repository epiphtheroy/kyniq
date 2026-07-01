import { redirect } from "next/navigation";
// Renamed: the Metatake Score now lives at /score.
export default function CodexRedirect() {
  redirect("/score");
}
