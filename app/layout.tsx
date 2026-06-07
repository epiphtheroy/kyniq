import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://filmcurio.com";

export const metadata: Metadata = {
  title: {
    default: "FilmCurio — Film Q&A Community",
    template: "%s · FilmCurio",
  },
  description:
    "Read films closely. FilmCurio is a cabinet of cinema's curiosities — a global film Q&A community for meaning, symbolism, and intent.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "FilmCurio",
    title: "FilmCurio — Film Q&A Community",
    description:
      "Read films closely. A cabinet of cinema's curiosities — a global film Q&A community.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FilmCurio — Film Q&A Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FilmCurio — Film Q&A Community",
    description:
      "Read films closely. A cabinet of cinema's curiosities — a global film Q&A community.",
    images: ["/og-image.png"],
  },
  other: {
    "theme-color": "#16233F",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

