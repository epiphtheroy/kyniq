import "./locations.css";
import { createClient } from "@/lib/supabase/server";
import LocationsWorkspace, {
  type GeoData, type CountryRefRow, type NatLineage,
} from "@/components/room/LocationsWorkspace";
import { STR } from "@/components/room/strings";

export const dynamic = "force-dynamic";

/* lineage_index row (public RPC — same one the /lineage hub uses). */
type IdxRow = { facet: string; slug: string; label: string; country: string | null; film_count: number | string | null };

export default async function RoomLocationsPage() {
  const supabase = await createClient();
  /* Personal RPC unchanged (me_geo_coverage, single json — cap-safe). The payload
     carries a continent only for countries the user has SEEN (verified against the
     RPC SQL), so the blind-continent territory lists come from two PUBLIC reads:
     the country_continents reference table (RLS read-all, ~170 rows) and the
     national subset of lineage_index (public /lineage deep links). No new RPCs. */
  const [geoRes, refRes, idxRes] = await Promise.all([
    supabase.rpc("me_geo_coverage"),
    supabase.from("country_continents").select("country,continent"),
    supabase.rpc("lineage_index"),
  ]);

  if (geoRes.error) {
    return (
      <div className="mainpad">
        <div className="errcard"><i className="ti ti-alert-triangle" />{STR.common.errorLoad}</div>
      </div>
    );
  }

  const geo = (geoRes.data as GeoData | null) ?? { points: [], by_country: [], totals: null };
  /* Reference reads are enrichment only — if they fail, the map still renders
     (blind inspectors just list fewer doors). */
  const countryRef = (refRes.data as CountryRefRow[] | null) ?? [];
  const national: NatLineage[] = ((idxRes.data as IdxRow[] | null) ?? [])
    .filter((r) => r.facet === "national" && Number(r.film_count ?? 0) > 0)
    .map((r) => ({ slug: r.slug, label: r.label, country: r.country }));

  return <LocationsWorkspace data={geo} countryRef={countryRef} nationalLineages={national} />;
}
