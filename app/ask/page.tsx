import { permanentRedirect } from "next/navigation";
// The "Metatake AI" slot now leads to Metatake Search (owner decision
// 2026-07-10); the original AI answer page is preserved at /ask-ai.
export default function AskRedirect() { permanentRedirect("/search"); }
