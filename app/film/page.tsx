import Link from "next/link";
import Image from "next/image";
import { getAllFilms, posterUrl } from "@/lib/tmdb";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Films — Metatake",
  description:
    "Browse films on Metatake. Read community interpretations, analysis, and discussions about cinema's most thought-provoking works.",
};

export const revalidate = 3600;

export default async function FilmsPage() {
  const films = await getAllFilms();

  return (
    <section>
      <h1
        className="disp"
        style={{ fontSize: "28px", margin: "0 0 8px" }}
      >
        Films
      </h1>
      <p
        className="body muted"
        style={{
          fontSize: "16px",
          margin: "0 0 24px",
          maxWidth: "55ch",
        }}
      >
        Browse the films our community is interpreting. Each film page
        collects every question, reading, and canonical answer.
      </p>

      <hr className="rule" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0",
        }}
      >
        {films.map((film) => {
          const poster = posterUrl(film.poster_path, "w185");
          return (
            <Link
              key={film.id}
              href={`/film/${film.slug}`}
              style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                padding: "16px 0",
                borderBottom: "1px solid var(--hairline)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {/* Poster thumbnail */}
              <div
                style={{
                  width: "56px",
                  height: "80px",
                  position: "relative",
                  flexShrink: 0,
                  borderRadius: "3px",
                  overflow: "hidden",
                  background:
                    "linear-gradient(160deg, #2c3340, #1b2028)",
                }}
              >
                {poster && (
                  <Image
                    src={poster}
                    alt={`${film.title} poster`}
                    fill
                    sizes="56px"
                    style={{
                      objectFit: "cover",
                      filter: "saturate(0.7)",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="disp"
                  style={{ fontSize: "18px", lineHeight: "1.25" }}
                >
                  {film.title}
                </div>
                <div
                  className="ui muted"
                  style={{ fontSize: "13px", marginTop: "4px" }}
                >
                  {film.year} · dir. {film.director ?? "Unknown"}
                </div>
                {film.overview && (
                  <p
                    className="body muted"
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.5",
                      margin: "6px 0 0",
                      maxWidth: "50ch",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {film.overview}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
