import type { Metadata } from "next";
import SiteNav from "@/components/home2/SiteNav";
import SearchTypeahead from "@/components/SearchTypeahead";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Where to watch — find any film's streaming, rental, disc & subtitles · Metatake",
  description:
    "Search any film and see where to watch it — streaming, rent and buy by country (via JustWatch & TMDB), plus MetaTake-verified free archives, MUBI country differences, disc editions and subtitle links.",
};

export default function WhereToWatchPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <h1 className="lh-h1">Where to watch</h1>
        <p className="lh-def">
          Search any film to see where you can watch it — streaming, rent and buy by country
          (via JustWatch &amp; TMDB), plus MetaTake-verified free archives, MUBI country
          differences, disc editions and subtitle links. Start typing a title or director.
        </p>
        <div style={{ maxWidth: "560px", margin: "18px 0 6px" }}>
          <SearchTypeahead autoFocus />
        </div>
        <p className="df-src">
          Every film page ends with a <b>Where&nbsp;to&nbsp;watch</b> tab. Streaming availability
          provided by JustWatch · TMDB; free-archive, disc and subtitle sources are verified by MetaTake.
        </p>
      </div>
    </div>
  );
}
