/**
 * Admin Docs — body map (slug → markdown string).
 * One file per doc in this directory; metadata/order lives in
 * lib/admindocs/registry.ts. Empty-string bodies render as 404.
 */
import businessTouchpoints from "./business-touchpoints";
import talkLayer from "./talk-layer";

export const ADMIN_DOC_BODIES: Record<string, string> = {
  "business-touchpoints": businessTouchpoints,
  "talk-layer": talkLayer,
};
