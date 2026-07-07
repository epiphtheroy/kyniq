import { permanentRedirect } from "next/navigation";

/**
 * /idea → /concept (terminology charter 2026-07-07: one noun per entity;
 * "Concept" is the canonical name and /concept the canonical route — the SM
 * registry that lived here now serves it). 308 so any shared URLs transfer.
 */
export default function OldIdeaRedirect() {
  permanentRedirect("/concept");
}
