/**
 * Test script: Import dummy films via the CSV import logic,
 * then verify they appear in the DB with pipeline flags.
 *
 * Usage: DOTENV_CONFIG_PATH=../.env.local npx tsx src/test-import.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
if (!TMDB_TOKEN) {
    console.error("Missing TMDB_READ_TOKEN");
    process.exit(1);
}
// ── Test CSV data (10 well-known films) ──────────────────────────
const TEST_CSV = `
# TMDB ID, English Title, Director
496243, Parasite, Bong Joon-ho
497, The Green Mile, Frank Darabont
120, The Lord of the Rings: The Fellowship of the Ring, Peter Jackson
278, The Shawshank Redemption, Frank Darabont
155, The Dark Knight, Christopher Nolan
550, Fight Club, David Fincher
680, Pulp Fiction, Quentin Tarantino
13, Forrest Gump, Robert Zemeckis
238, The Godfather, Francis Ford Coppola
244786, Whiplash, Damien Chazelle
`.trim();
// ── TMDB helpers ────────────────────────────────────────────────
async function tmdbFetch(path) {
    const separator = path.includes("?") ? "&" : "?";
    const res = await fetch(`https://api.themoviedb.org/3${path}${separator}api_key=${TMDB_TOKEN}`, {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        console.error(`  TMDB ${res.status}: ${path}`);
        return null;
    }
    return res.json();
}
function extractDirector(movie) {
    const credits = movie.credits;
    if (!credits?.crew)
        return "";
    return credits.crew.find((c) => c.job === "Director")?.name ?? "";
}
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
// ── Main test ───────────────────────────────────────────────────
async function main() {
    console.log("🎬 Testing film import pipeline\n");
    // Parse CSV
    const lines = TEST_CSV.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
    console.log(`📋 ${lines.length} films to import\n`);
    let imported = 0;
    let errors = 0;
    for (const line of lines) {
        const parts = line.split(",").map((p) => p.trim());
        const tmdbId = parseInt(parts[0]);
        const title = parts[1];
        const director = parts[2];
        process.stdout.write(`  ${title} (TMDB:${tmdbId})...`);
        // Resolve from TMDB
        const movie = await tmdbFetch(`/movie/${tmdbId}?append_to_response=credits`);
        if (!movie) {
            console.log(" ❌ TMDB not found");
            errors++;
            continue;
        }
        const resolvedTitle = movie.title ?? title;
        const releaseDate = movie.release_date;
        const year = releaseDate ? parseInt(releaseDate.slice(0, 4)) : undefined;
        const resolvedDirector = extractDirector(movie) || director;
        const slug = `${slugify(resolvedTitle)}-${year ?? "unknown"}`;
        const { error: upsertErr } = await supabase.from("films").upsert({
            tmdb_id: tmdbId,
            title: resolvedTitle,
            original_title: movie.original_title ?? resolvedTitle,
            year,
            director: resolvedDirector,
            director_slug: resolvedDirector ? slugify(resolvedDirector) : null,
            poster_path: movie.poster_path,
            overview: movie.overview,
            genres: (movie.genres ?? []).map((g) => g.name),
            slug,
            in_pipeline: true,
            pipeline_status: "queued",
            questions_target: 10,
        }, { onConflict: "tmdb_id" });
        if (upsertErr) {
            // Try with unique slug
            const { error: retryErr } = await supabase.from("films").upsert({
                tmdb_id: tmdbId,
                title: resolvedTitle,
                original_title: movie.original_title ?? resolvedTitle,
                year,
                director: resolvedDirector,
                director_slug: resolvedDirector ? slugify(resolvedDirector) : null,
                poster_path: movie.poster_path,
                overview: movie.overview,
                genres: (movie.genres ?? []).map((g) => g.name),
                slug: `${slug}-${tmdbId}`,
                in_pipeline: true,
                pipeline_status: "queued",
                questions_target: 10,
            }, { onConflict: "tmdb_id" });
            if (retryErr) {
                console.log(` ❌ ${retryErr.message}`);
                errors++;
                continue;
            }
        }
        imported++;
        console.log(` ✅ ${resolvedTitle} (${year}) — ${resolvedDirector}`);
        // Rate limit
        await new Promise((r) => setTimeout(r, 250));
    }
    console.log(`\n📊 Results: ${imported} imported, ${errors} errors\n`);
    // Verify pipeline films
    const { data: pipelineFilms } = await supabase
        .from("films")
        .select("title, year, director, in_pipeline, pipeline_status, questions_target, questions_published")
        .eq("in_pipeline", true)
        .order("title");
    console.log("🔍 Pipeline films in DB:");
    console.log("─".repeat(80));
    for (const f of pipelineFilms ?? []) {
        console.log(`  ${f.pipeline_status.padEnd(12)} ${f.questions_published}/${f.questions_target}  ${f.title} (${f.year}) — ${f.director}`);
    }
    console.log("─".repeat(80));
    console.log(`Total: ${pipelineFilms?.length ?? 0} films in pipeline\n`);
    console.log("✅ Test complete! The scheduler will auto-pick these films when the queue is empty.");
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=test-import.js.map