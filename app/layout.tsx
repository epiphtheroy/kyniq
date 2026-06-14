import type { Metadata } from "next";
import Footer from "@/components/Footer";
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
    title: "Metatake — A Critical Map of Cinema",
    description:
      "Read films closely. A critical map of cinema that links films through the readings and meanings they share.",
    images: ["/og-image.png"],
  },
  other: {
    "theme-color": "#FFFFFF",
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
        {children}
        <Footer />
      </body>
    </html>
  );
}

