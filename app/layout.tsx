import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Metrics from "@/components/Metrics";
import Footer from "@/components/Footer";
import GlobalCmdK from "@/components/GlobalCmdK";
import LocaleSuggestBanner from "@/components/i18n/LocaleSuggestBanner";
import { UserFilmsProvider } from "@/components/UserFilmsProvider";
import { UserSavesProvider } from "@/components/UserSavesProvider";
import { LensProvider } from "@/components/LensProvider";
import { pageRobots, ORG_SAME_AS, KNOWS_ABOUT, PERSON_SAME_AS } from "@/lib/seo";
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
  // Send the full referring URL (not just the origin) to external sites when a
  // visitor clicks an outbound link, so metatake.net — with the exact page —
  // shows up in the target server's referrer logs. "no-referrer-when-downgrade"
  // sends the full path to HTTPS destinations and nothing on an HTTPS→HTTP
  // downgrade (the safe default). Note: a per-link noreferrer token would
  // override this to send nothing, which is why those were stripped site-wide.
  referrer: "no-referrer-when-downgrade",
  robots: pageRobots(),
  verification: {
    // Google Search Console (URL-prefix property https://metatake.net)
    google: "Xlx_jr5Fg6VjxZXktgB9huxHQ_1lfGgDOuiSWGP60Gs",
    other: {
      // Bing Webmaster Tools (also verifiable via public/BingSiteAuth.xml — same token)
      "msvalidate.01": "B19CC42557D19874EA92BD9497BB2F68",
      // Naver Search Advisor (searchadvisor.naver.com, property https://metatake.net).
      // Hardcoded like Google/Bing above — verification tokens are public. Just the
      // token, not the surrounding <meta ...> tag (Next wraps it). NB: do NOT read
      // this from an env var — a malformed `content="…"` value once shipped a broken
      // double-wrapped tag; the literal token is the single source of truth.
      "naver-site-verification": "b2140ad0730191ac272895f2cde3ba6c0b226e0f",
    },
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
    // Editor + lead author of the criticism; PhD (Kyung Hee University, 2022).
    // NOT a professor — do not add a professor jobTitle (editor-identity policy).
    jobTitle: "Editor",
    knowsAbout: ["Film criticism", "Film theory"],
    alumniOf: { "@type": "CollegeOrUniversity", name: "Kyung Hee University" },
    ...(PERSON_SAME_AS.length > 0 ? { sameAs: PERSON_SAME_AS } : {}),
  },
  description:
    "A critical map of cinema — nearly 7,000 films connected through 70,000+ close readings in one embedding space.",
  knowsAbout: KNOWS_ABOUT,
  email: "wonwoo@metatake.net",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "business partnerships",
    email: "wonwoo@metatake.net",
    url: `${siteUrl}/partners`,
  },
  ...(ORG_SAME_AS.length > 0 ? { sameAs: ORG_SAME_AS } : {}),
};

// WebSite schema: qualifies the site-name display in SERPs and the sitelinks
// search box (SearchAction → /search?q=).
const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "Metatake",
  alternateName: "Metatake — A Critical Map of Cinema",
  url: siteUrl,
  publisher: { "@id": `${siteUrl}/#org` },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <LocaleSuggestBanner />
        <UserFilmsProvider><UserSavesProvider><LensProvider>{children}</LensProvider></UserSavesProvider></UserFilmsProvider>
        <Footer />
        <GlobalCmdK />
        <Analytics />
        <Metrics />
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          // Microsoft Clarity (session replay + heatmaps) — activates only when
          // NEXT_PUBLIC_CLARITY_ID is set in Vercel env. Free, unlimited.
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`,
            }}
          />
        )}
      </body>
    </html>
  );
}

