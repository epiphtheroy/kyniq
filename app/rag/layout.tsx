/**
 * RAG route segment layout. Its only job is to load the RAG-scoped styles
 * (app/rag/rag.css) for this segment, so the global app/globals.css is NOT
 * modified by the RAG feature. Everything the RAG surface needs lives under
 * app/rag/ (page, styles, _components, _lib); the only files outside this
 * folder are the API route (app/api/rag/route.ts — Next.js requires API routes
 * under app/api/) and the one shared nav link in components/MetatakeNav.tsx.
 */
import type { Metadata } from "next";
import "./rag.css";

// Interactive research tool — noindex (page is a client component).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function RagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
