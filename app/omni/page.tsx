import { permanentRedirect } from "next/navigation";
// Omni was renamed: the search-first surface now lives at /search
// (brand: "Metatake Search"). Old links keep working via this 308.
export default function OmniRedirect() { permanentRedirect("/search"); }
