// IndexNow key file — search engines fetch this to verify ownership of the key
// used by scripts/indexnow-ping.mjs.
export const dynamic = "force-static";

export function GET() {
  return new Response("d9573fee6366ea988f6adb32a671983f", {
    headers: { "Content-Type": "text/plain" },
  });
}
