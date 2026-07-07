import { redirect } from "next/navigation";

/** v2: the operating desk was absorbed into the room home (tonight's pick,
 *  candidates, write paths all promoted to /room). Route kept as a redirect
 *  for bookmark compatibility (inside watcher staging scope = app/). */
export default function RoomDeskRedirect() {
  redirect("/room");
}
