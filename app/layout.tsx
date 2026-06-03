import type { Metadata } from "next";
import { Fraunces, Newsreader, Hanken_Grotesk } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
  weight: ["400", "500"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kyniq.io";

export const metadata: Metadata = {
  title: {
    default: "Kyniq — Film Interpretation Community",
    template: "%s | Kyniq",
  },
  description:
    "Read films closely. Kyniq is a community Q&A platform for interpreting difficult films — meaning, symbolism, and intent.",
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
    siteName: "Kyniq",
    title: "Kyniq — Film Interpretation Community",
    description:
      "Read films closely. A community Q&A platform for interpreting difficult films.",
    url: siteUrl,
    images: [
      {
        url: "/kyniq-logo-paper.png",
        width: 1200,
        height: 630,
        alt: "Kyniq — Film Interpretation Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kyniq — Film Interpretation Community",
    description:
      "Read films closely. A community Q&A platform for interpreting difficult films.",
    images: ["/kyniq-logo-paper.png"],
  },
  other: {
    "theme-color": "#1A2740",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${hankenGrotesk.variable}`}
    >
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
