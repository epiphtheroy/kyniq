import { redirect } from "next/navigation";

// The full-screen kiosk moved to /tv/full. Keep the old URL alive.
export default function RandomV2Redirect() {
  redirect("/tv/full");
}
