import LensWorkspace from "@/components/room/LensWorkspace";
import "./lens.css";

export const dynamic = "force-dynamic";

/** Lens — client-fetch-first (spec §3.11): the ONLY /room screen that renders
 *  its shell immediately with per-panel skeletons. All data flows through the
 *  session-validated /api/lens/* routes (private, no-store) — nothing is
 *  fetched here on the server. */
export default function RoomLensPage() {
  return <LensWorkspace />;
}
