import { permanentRedirect } from "next/navigation";

// Movements is now a section of Lineage (National cinemas + Movements tabs). Redirect the old index.
// MvHub type kept here as the shared shape for movements_index() consumers.
export type MvHub = {
  slug: string; label: string; film_count: number; thumbs: string[];
  region?: string | null; tier?: string | null; hub_type?: string | null;
  status?: string | null; country_code?: string | null; description?: string | null;
};

export default function MovementsIndex() {
  permanentRedirect("/lineage");
}
