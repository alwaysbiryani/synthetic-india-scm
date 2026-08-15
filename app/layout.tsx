import type { Metadata } from "next";
import { EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kick the tires — unofficial Synthetic India playground",
  description:
    "An independent playground inspired by Grier & Grier (2026): stack standard criticisms, change donor weights and scoring windows, and see how India vs Synthetic India moves. Not the authors’ official site or analysis.",
  openGraph: {
    title: "Kick the tires — unofficial Synthetic India playground",
    description:
      "Independent, unofficial sandbox for trying criticisms of Grier & Grier (2026). Not affiliated with the authors or Texas Tech.",
    url: "https://github.com/alwaysbiryani/synthetic-india-scm",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper font-serif text-ink">{children}</body>
    </html>
  );
}
