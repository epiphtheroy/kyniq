import type { Metadata } from "next";
import ConnectCallbackClient from "@/components/ConnectCallbackClient";

/**
 * Web leg of the Connect OAuth dance (HANDOFF-커넥트-기록이관.md §2.4).
 * The provider redirects the member's browser here; the client component
 * completes the token exchange via /api/connect/[provider]/callback and
 * bounces back to /me/import with an inline outcome. Never indexed.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Connecting…",
  robots: { index: false, follow: false },
};

export default function ConnectCallbackPage() {
  return <ConnectCallbackClient />;
}
