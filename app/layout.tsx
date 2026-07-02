import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Footer from "@/components/Footer";
import TakeScoreBadges from "@/components/TakeScoreBadges";
import { UserFilmsProvider } from "@/components/UserFilmsProvider";
import { UserSavesProvider } from "@/components/UserSavesProvider";
import { pageRobots } from "@/lib/seo";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";

export const metadata: Metadata = {
  title: {
    default: "Metatake — A Critical Map of Cinema",
    template: "%s · Metatake",
  },
  description:
    "Read films closely. Metatake breaks films into their figures and the critical readings they carry, then links films through the meanings they share — a critical map of cinema.",
  metadataBase: new URL(siteUrl),
  robots: pageRobots(),
  verification: {
    // Google Search Console (URL-prefix property https://metatake.net)
    google: "Xlx_jr5Fg6VjxZXktgB9huxHQ_1lfGgDOuiSWGP60Gs",
    // Bing Webmaster Tools (also verifiable via public/BingSiteAuth.xml — same token)
    other: { "msvalidate.01": "B19CC42557D19874EA92BD9497BB2F68" },
  },
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
  alternates: {
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "Between Film and the World — Metatake" }] },
  },
  openGraph: {
    type: "website",
    siteName: "Metatake",
    title: "Metatake — A Critical Map of Cinema",
    description:
      "Read films closely. A critical map of cinema that links films through the readings and meanings they share.",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Metatake — A Critical Map of Cinema",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  other: {
    "theme-color": "#FFFFFF",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#org`,
  name: "Metatake",
  url: siteUrl,
  logo: `${siteUrl}/og-image.png`,
  foundingLocation: { "@type": "Place", name: "Seoul, Republic of Korea" },
  founder: {
    "@type": "Person",
    "@id": `${siteUrl}/editor#person`,
    name: "Wonwoo Yoon",
    url: `${siteUrl}/editor`,
  },
  description:
    "A critical map of cinema — 1,900+ films linked through 26,000+ close readings in one embedding space.",
  email: "wonwoo@metatake.net",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* Newspaper type: PT Serif ≈ headline/body serif, Inter ≈ chrome sans */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Inter:wght@300..700&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <UserFilmsProvider><UserSavesProvider>{children}</UserSavesProvider></UserFilmsProvider>
        <TakeScoreBadges />
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}

