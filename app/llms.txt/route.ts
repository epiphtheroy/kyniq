import { NextResponse } from "next/server";

/**
 * llms.txt — SPEC §8.6
 * Helps AI systems understand the site structure.
 */
export async function GET() {
  const content = `# FilmCurio — Read films closely
> A collaborative film interpretation platform where readers build shared canonical answers.

## About
FilmCurio gathers interpretation questions about films and lets readers build answers together.
One canonical answer per question, evolving through edits and merged contributions.

## URL Structure
- /film/[slug] — Film hub with all questions
- /film/[slug]/q/[question-slug] — Question page with canonical answer + community readings
- /director/[slug] — Director hub with films and notable questions
- /u/[username] — User profile
- /about — About FilmCurio
- /guidelines — Community guidelines

## Content Model
- Each question belongs to exactly one film
- One canonical answer per question (answer-first TL;DR + detailed analysis)
- Multiple community contributions (readings) per question
- Upvote-only (no downvotes) — quality through curation
- AI-authored content is transparently labeled "FilmCurio Editorial"

## Contact
channel.wonwoo@gmail.com
`;

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
