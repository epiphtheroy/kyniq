/**
 * Curiobot — Media Auto-Embedding (Loop 3)
 *
 * Two paths:
 *   (a) Inline: called from graph.ts during AI content generation
 *   (b) Sweep:  background job every ~3 hours finds published questions lacking media
 *
 * Sources:
 *   - TMDB: backdrops/stills (images, with attribution)
 *   - YouTube: Data API search → relevance + spoiler filter → click-to-load facade
 *
 * Rules:
 *   - TMDB only for images (no web scraping, no user uploads)
 *   - YouTube official embed only (embed-disabled videos are dropped)
 *   - Automated spoiler/appropriateness filter on video titles
 *   - Logs to content_events
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── TMDB Image Curator ────────────────────────────────────────────

export async function curateTMDBImages(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  filmTmdbId: number,
  maxImages = 3
): Promise<number> {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) return 0;

  // Check for existing media to avoid duplicates
  const { count: existing } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("source", "tmdb");

  if ((existing ?? 0) >= maxImages) return 0;

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${filmTmdbId}/images?api_key=${token}`
  );
  if (!res.ok) return 0;

  const data = await res.json();
  const backdrops = (data.backdrops ?? [])
    .sort(
      (a: { vote_average: number }, b: { vote_average: number }) =>
        b.vote_average - a.vote_average
    )
    .slice(0, maxImages);

  if (backdrops.length === 0) return 0;

  const rows = backdrops.map(
    (
      img: { file_path: string; vote_average: number; width: number },
      i: number
    ) => ({
      entity_type: entityType,
      entity_id: entityId,
      kind: "image",
      source: "tmdb",
      external_id: img.file_path,
      url: `https://image.tmdb.org/t/p/w1280${img.file_path}`,
      thumbnail_url: `https://image.tmdb.org/t/p/w780${img.file_path}`,
      attribution: "Image © TMDB",
      position: i,
      added_by: "ai",
      confidence: Math.min(img.vote_average / 10, 1),
      status: "published",
      meta: { width: img.width, vote_average: img.vote_average },
    })
  );

  const { error } = await supabase.from("media").upsert(rows, {
    onConflict: "entity_type,entity_id,source,external_id",
  });
  return error ? 0 : rows.length;
}

// ── YouTube Video Curator ─────────────────────────────────────────

const SPOILER_KEYWORDS = [
  "ending explained",
  "ending scene",
  "death scene",
  "kills",
  "dies",
  "final scene",
  "twist ending",
  "shocking ending",
  "plot twist reveal",
  "who killed",
  "full movie",
  "all deaths",
  "reaction",
  "clickbait",
];

const PREFERRED_CHANNELS = [
  "Nerdwriter1",
  "Every Frame a Painting",
  "Like Stories of Old",
  "The Discarded Image",
  "Lessons from the Screenplay",
  "Now You See It",
  "CineFix",
  "ScreenPrism",
  "The Take",
  "Channel Criswell",
];

function isSpoilery(title: string): boolean {
  const lower = title.toLowerCase();
  return SPOILER_KEYWORDS.some((kw) => lower.includes(kw));
}

function scoreVideo(video: {
  title: string;
  channelTitle: string;
  viewCount?: string;
}): number {
  let score = 0.5; // base

  // Preferred channels get a boost
  if (
    PREFERRED_CHANNELS.some(
      (ch) => ch.toLowerCase() === video.channelTitle.toLowerCase()
    )
  ) {
    score += 0.3;
  }

  // Video essays and analysis get a boost
  const lower = video.title.toLowerCase();
  if (
    lower.includes("explained") ||
    lower.includes("analysis") ||
    lower.includes("essay") ||
    lower.includes("meaning") ||
    lower.includes("cinematography") ||
    lower.includes("symbolism")
  ) {
    score += 0.15;
  }

  // Official trailers are always relevant
  if (lower.includes("trailer") && lower.includes("official")) {
    score += 0.2;
  }

  // Penalize reaction videos
  if (
    lower.includes("reaction") ||
    lower.includes("first time watching") ||
    lower.includes("reacting to")
  ) {
    score -= 0.4;
  }

  // Penalize very short titles (likely junk)
  if (video.title.length < 10) {
    score -= 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

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

interface YouTubeVideoDetail {
  id: string;
  contentDetails: {
    duration: string;
  };
  status: {
    embeddable: boolean;
  };
  statistics?: {
    viewCount: string;
  };
}

function parseDuration(iso: string): string {
  // PT12M41S → 12:41, PT1H5M → 1:05:00
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] ?? "0");
  const m = parseInt(match[2] ?? "0");
  const s = parseInt(match[3] ?? "0");

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function curateYouTubeVideos(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  filmTitle: string,
  filmYear: number | null,
  filmDirector?: string,
  _questionTitle?: string,
  maxVideos = 2
): Promise<number> {
  const apiKey =
    process.env.YOUTUBE_API_KEY ?? process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return 0;

  // Check for existing YouTube media
  const { count: existing } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("source", "youtube");

  if ((existing ?? 0) >= maxVideos) return 0;

  // BUG #4 FIX: Search by film identity ONLY (title + year + director),
  // NOT question keywords. Loose question-keyword matching attached
  // irrelevant clips (e.g. asteroid videos to Stalker).
  let query = `"${filmTitle}"`; // exact match on film title
  if (filmYear) query += ` ${filmYear}`;
  if (filmDirector) query += ` ${filmDirector}`;
  query += " film"; // ensure we're in the film domain

  // Search YouTube
  const searchUrl = new URL(
    "https://www.googleapis.com/youtube/v3/search"
  );
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("relevanceLanguage", "en");
  searchUrl.searchParams.set("safeSearch", "moderate");
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    console.error(
      `[curiobot] YouTube search failed: ${searchRes.status} ${await searchRes.text()}`
    );
    return 0;
  }

  const searchData = await searchRes.json();
  const items = (searchData.items ?? []) as YouTubeSearchItem[];

  if (items.length === 0) return 0;

  // Get video details (duration + embeddable status)
  const videoIds = items.map((i) => i.id.videoId).join(",");
  const detailsUrl = new URL(
    "https://www.googleapis.com/youtube/v3/videos"
  );
  detailsUrl.searchParams.set("part", "contentDetails,status,statistics");
  detailsUrl.searchParams.set("id", videoIds);
  detailsUrl.searchParams.set("key", apiKey);

  const detailsRes = await fetch(detailsUrl.toString());
  if (!detailsRes.ok) return 0;

  const detailsData = await detailsRes.json();
  const details = new Map<string, YouTubeVideoDetail>();
  for (const d of (detailsData.items ?? []) as YouTubeVideoDetail[]) {
    details.set(d.id, d);
  }

  // BUG #4 FIX: Film-title presence check — reject videos whose title
  // doesn't contain the film title or director name (prevents generic matches).
  const filmTitleLower = filmTitle.toLowerCase();
  const directorLower = (filmDirector ?? "").toLowerCase();

  // Filter + score + rank
  const candidates = items
    .map((item) => {
      const detail = details.get(item.id.videoId);
      if (!detail) return null;

      // Drop non-embeddable
      if (!detail.status.embeddable) return null;

      // BUG #4: Reject if video title doesn't mention the film OR director
      const videoTitleLower = item.snippet.title.toLowerCase();
      const mentionsFilm = videoTitleLower.includes(filmTitleLower);
      const mentionsDirector = directorLower.length > 2 && videoTitleLower.includes(directorLower);
      if (!mentionsFilm && !mentionsDirector) return null;

      // Spoiler filter
      const spoilery = isSpoilery(item.snippet.title);
      if (spoilery) return null;

      const score = scoreVideo({
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        viewCount: detail.statistics?.viewCount,
      });

      // Skip low-confidence matches (raised from 0.3 to 0.45)
      if (score < 0.45) return null;

      return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description.slice(0, 300),
        channelTitle: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails.high?.url ??
          item.snippet.thumbnails.medium?.url ??
          item.snippet.thumbnails.default?.url ??
          "",
        duration: parseDuration(detail.contentDetails.duration),
        score,
        spoilery,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, maxVideos);

  if (candidates.length === 0) return 0;

  // Write to media table
  const rows = candidates.map((c, i) => ({
    entity_type: entityType,
    entity_id: entityId,
    kind: "video",
    source: "youtube",
    external_id: c!.videoId,
    url: `https://www.youtube.com/watch?v=${c!.videoId}`,
    thumbnail_url: c!.thumbnail,
    title: c!.title,
    description: c!.description,
    attribution: `YouTube · ${c!.channelTitle}`,
    channel_name: c!.channelTitle,
    duration: c!.duration,
    position: i,
    added_by: "ai" as const,
    confidence: c!.score,
    spoiler_flagged: false,
    status: "published",
    meta: { query, score: c!.score },
  }));

  const { error } = await supabase.from("media").upsert(rows, {
    onConflict: "entity_type,entity_id,source,external_id",
  });

  return error ? 0 : rows.length;
}

// ── Full curation (images + videos) ───────────────────────────────

export async function curateMedia(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  filmTmdbId: number,
  filmTitle: string,
  filmYear: number | null,
  filmDirector?: string,
  questionTitle?: string
): Promise<{ images: number; videos: number }> {
  const images = await curateTMDBImages(
    supabase,
    entityType,
    entityId,
    filmTmdbId,
    3
  );
  const videos = await curateYouTubeVideos(
    supabase,
    entityType,
    entityId,
    filmTitle,
    filmYear,
    filmDirector,
    questionTitle,
    2
  );

  return { images, videos };
}

// ── Background sweep (Loop 3 standalone) ──────────────────────────

export async function runCuriobotSweep(supabase: SupabaseClient): Promise<{
  enriched: number;
  errors: number;
}> {
  let enriched = 0;
  let errors = 0;

  // Find published questions lacking media (no media rows at all)
  let questionsWithoutMedia = null;
  try {
    const { data } = await supabase.rpc("questions_without_media");
    questionsWithoutMedia = data;
  } catch {
    // RPC doesn't exist yet — fall through to manual query
  }

  // Fallback: manual query if RPC doesn't exist
  let candidates: Array<{
    id: string;
    title: string;
    film_id: string;
  }> = [];

  if (questionsWithoutMedia) {
    candidates = questionsWithoutMedia;
  } else {
    // Find published questions and check media count
    const { data: publishedQs } = await supabase
      .from("questions")
      .select("id, title, film_id")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);

    for (const q of publishedQs ?? []) {
      const { count } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "question")
        .eq("entity_id", q.id);

      if ((count ?? 0) === 0) {
        candidates.push(q);
      }
    }
  }

  // Process up to 10 per sweep cycle
  for (const q of candidates.slice(0, 10)) {
    try {
      // Load film context
      const { data: film } = await supabase
        .from("films")
        .select("tmdb_id, title, year, director")
        .eq("id", q.film_id)
        .single();

      if (!film) continue;

      const result = await curateMedia(
        supabase,
        "question",
        q.id,
        film.tmdb_id,
        film.title,
        film.year,
        film.director,
        q.title
      );

      const total = result.images + result.videos;
      if (total > 0) {
        enriched++;
        console.log(
          `[curiobot] 🎬 Enriched: "${q.title}" → ${result.images} images, ${result.videos} videos`
        );

        // Log content event
        await supabase.from("content_events").insert({
          entity_type: "question",
          entity_id: q.id,
          event: "media_curated",
          actor_kind: "ai",
          meta: { ...result, source: "curiobot_sweep" },
        });
      }

      // Rate limit: 500ms between questions
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      errors++;
      console.error(
        `[curiobot] Error enriching "${q.title}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (enriched > 0 || errors > 0) {
    console.log(
      `[curiobot] Sweep done: ${enriched} enriched, ${errors} errors`
    );
  }

  return { enriched, errors };
}
