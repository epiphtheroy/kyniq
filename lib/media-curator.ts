/**
 * Media Curator — auto-attaches TMDB images + YouTube videos to questions.
 *
 * Two run paths:
 * 1. Called as a step in the pipeline worker graph (for AI-authored Q&A)
 * 2. Background enrichment when a human question is published
 *
 * Rules (§3.3):
 * - Images: TMDB only (no scraping, no uploads)
 * - Video: YouTube official embed + Data API
 * - Auto-attach with relevance + spoiler filter
 * - Published-gated (RLS)
 * - Lazy-load images, click-to-load YouTube facade
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logContentEvent } from "@/lib/admin";

// ── Types ─────────────────────────────────────────────────────────

interface MediaItem {
  entity_type: "question" | "film";
  entity_id: string;
  kind: "image" | "video";
  source: "tmdb" | "youtube";
  external_id: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  attribution: string;
  position: number;
  added_by: "ai" | "human";
  confidence: number;
  status: "published" | "draft";
}

interface CuratorResult {
  images: number;
  videos: number;
  skipped: number;
}

// ── TMDB Image Curator ────────────────────────────────────────────

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
  iso_639_1: string | null;
}

async function fetchTMDBImages(
  tmdbId: number
): Promise<{ backdrops: TMDBImage[]; stills: TMDBImage[]; posters: TMDBImage[] }> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error("TMDB_READ_TOKEN not configured");

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}/images`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    console.error(`TMDB images API error ${res.status} for tmdbId=${tmdbId}`);
    return { backdrops: [], stills: [], posters: [] };
  }

  const data = await res.json();
  return {
    backdrops: (data.backdrops ?? []) as TMDBImage[],
    stills: [], // stills require /movie/{id}/images?include_image_language=null
    posters: (data.posters ?? []) as TMDBImage[],
  };
}

/**
 * Curate TMDB images for a question/film entity.
 * Picks top backdrops by vote_average, avoids duplicates.
 */
export async function curateTMDBImages(
  entityType: "question" | "film",
  entityId: string,
  filmTmdbId: number,
  maxImages: number = 3
): Promise<number> {
  const supabase = createAdminClient();

  // Check existing media to avoid duplicates
  const { data: existing } = await supabase
    .from("media")
    .select("external_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("source", "tmdb");

  const existingIds = new Set((existing ?? []).map((m) => m.external_id));

  const images = await fetchTMDBImages(filmTmdbId);

  // Prefer backdrops (wider, more cinematic), then posters
  const candidates = [
    ...images.backdrops
      .filter((img) => !existingIds.has(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, maxImages),
    ...images.posters
      .filter((img) => !existingIds.has(img.file_path))
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 1), // max 1 poster
  ].slice(0, maxImages);

  if (candidates.length === 0) return 0;

  const rows: MediaItem[] = candidates.map((img, i) => ({
    entity_type: entityType,
    entity_id: entityId,
    kind: "image" as const,
    source: "tmdb" as const,
    external_id: img.file_path,
    url: `${TMDB_IMAGE_BASE}/w1280${img.file_path}`,
    thumbnail_url: `${TMDB_IMAGE_BASE}/w780${img.file_path}`,
    caption: null,
    attribution: "Image © TMDB",
    position: i,
    added_by: "ai" as const,
    confidence: Math.min(img.vote_average / 10, 1),
    status: "published" as const,
  }));

  const { error } = await supabase.from("media").insert(rows);
  if (error) {
    console.error("Failed to insert TMDB media:", error.message);
    return 0;
  }

  return rows.length;
}

// ── YouTube Video Curator ─────────────────────────────────────────

/** Spoiler keywords — videos with these in title are skipped */
const SPOILER_KEYWORDS = [
  "ending explained",
  "spoiler",
  "spoilers",
  "plot twist",
  "final scene",
  "death scene",
  "who dies",
  "ending",
  "full movie",
  "full film",
];

/** Low-quality channel/title patterns */
const JUNK_PATTERNS = [
  /reaction/i,
  /clickbait/i,
  /\bfan\s*edit\b/i,
  /\bfull\s*movie\b/i,
  /\bpirated?\b/i,
];

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

async function searchYouTube(
  query: string,
  maxResults: number = 5
): Promise<YouTubeSearchItem[]> {
  const key = process.env.YOUTUBE_DATA_API_KEY;
  if (!key) {
    console.warn("YOUTUBE_DATA_API_KEY not configured — skipping video curation");
    return [];
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(maxResults),
    key,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );

  if (!res.ok) {
    console.error(`YouTube API error ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.items ?? []) as YouTubeSearchItem[];
}

function isSpoilerVideo(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return SPOILER_KEYWORDS.some((kw) => text.includes(kw));
}

function isJunkVideo(title: string, channelTitle: string): boolean {
  const text = `${title} ${channelTitle}`;
  return JUNK_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Curate YouTube videos for a question entity.
 * Searches for relevant videos, filters spoilers/junk, attaches best matches.
 */
export async function curateYouTubeVideos(
  entityType: "question" | "film",
  entityId: string,
  filmTitle: string,
  filmYear: number | null,
  questionTitle?: string,
  maxVideos: number = 2
): Promise<number> {
  const supabase = createAdminClient();

  // Build search query
  const yearStr = filmYear ? ` (${filmYear})` : "";
  const queries = [
    `"${filmTitle}"${yearStr} analysis`,
    ...(questionTitle ? [`"${filmTitle}" ${questionTitle}`] : []),
    `"${filmTitle}"${yearStr} video essay`,
  ];

  // Check existing
  const { data: existing } = await supabase
    .from("media")
    .select("external_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("source", "youtube");

  const existingIds = new Set((existing ?? []).map((m) => m.external_id));

  const seenVideoIds = new Set<string>();
  const goodVideos: Array<{
    item: YouTubeSearchItem;
    confidence: number;
  }> = [];

  for (const query of queries) {
    if (goodVideos.length >= maxVideos) break;

    const results = await searchYouTube(query, 5);

    for (const item of results) {
      if (goodVideos.length >= maxVideos) break;

      const videoId = item.id.videoId;
      if (existingIds.has(videoId) || seenVideoIds.has(videoId)) continue;
      seenVideoIds.add(videoId);

      const { title, description, channelTitle } = item.snippet;

      // Filter spoilers
      if (isSpoilerVideo(title, description)) continue;
      // Filter junk
      if (isJunkVideo(title, channelTitle)) continue;

      // Confidence based on query match quality
      const titleLower = title.toLowerCase();
      const filmLower = filmTitle.toLowerCase();
      const hasFilmName = titleLower.includes(filmLower);
      const confidence = hasFilmName ? 0.85 : 0.6;

      if (confidence < 0.5) continue;

      goodVideos.push({ item, confidence });
    }
  }

  if (goodVideos.length === 0) return 0;

  const rows: MediaItem[] = goodVideos.map(({ item, confidence }, i) => {
    const thumb =
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      "";

    return {
      entity_type: entityType,
      entity_id: entityId,
      kind: "video" as const,
      source: "youtube" as const,
      external_id: item.id.videoId,
      url: `https://www.youtube.com/embed/${item.id.videoId}`,
      thumbnail_url: thumb,
      caption: item.snippet.title,
      attribution: `YouTube · ${item.snippet.channelTitle}`,
      position: i + 100, // videos after images
      added_by: "ai" as const,
      confidence,
      status: "published" as const,
    };
  });

  const { error } = await supabase.from("media").insert(rows);
  if (error) {
    console.error("Failed to insert YouTube media:", error.message);
    return 0;
  }

  return rows.length;
}

// ── Main curator entry point ──────────────────────────────────────

/**
 * Curate all media for a question — called by the pipeline worker
 * or the background enrichment job.
 */
export async function curateMediaForQuestion(
  questionId: string,
  filmId: string,
  filmTmdbId: number,
  filmTitle: string,
  filmYear: number | null,
  questionTitle?: string
): Promise<CuratorResult> {
  let images = 0;
  let videos = 0;
  let skipped = 0;

  try {
    images = await curateTMDBImages("question", questionId, filmTmdbId, 3);
  } catch (err) {
    console.error("TMDB curation failed:", err);
    skipped++;
  }

  try {
    videos = await curateYouTubeVideos(
      "question",
      questionId,
      filmTitle,
      filmYear,
      questionTitle,
      2
    );
  } catch (err) {
    console.error("YouTube curation failed:", err);
    skipped++;
  }

  // Log curation event
  try {
    await logContentEvent({
      entityType: "question",
      entityId: questionId,
      event: "media_curated",
      actorId: null,
      actorKind: "ai",
      meta: { images, videos, skipped, film_id: filmId },
    });
  } catch {
    /* best effort */
  }

  return { images, videos, skipped };
}

/**
 * Curate media for a film entity (backdrops for hero display).
 */
export async function curateMediaForFilm(
  filmId: string,
  filmTmdbId: number
): Promise<number> {
  return curateTMDBImages("film", filmId, filmTmdbId, 5);
}
