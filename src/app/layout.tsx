import type { Metadata, Viewport } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// UI is light-only (no dark: Tailwind variants anywhere) — declare it so an
// OS/browser dark theme doesn't auto-invert colors and break contrast.
export const viewport: Viewport = {
  colorScheme: "light",
};

// Generic default; overridden per-request in app/page metadata once URL state is read (REQ-18).
export const metadata: Metadata = {
  title: "Krankenkassenvergleich – Grundversicherung Schweiz",
  description:
    "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
  openGraph: {
    title: "Krankenkassenvergleich – Grundversicherung Schweiz",
    description:
      "Vergleiche Krankenkassenprämien für die Grundversicherung – alle Kassen, alle Modelle, offizielle BAG-Daten.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Krankenkassenvergleich – Grundversicherung Schweiz",
    description: "Vergleiche Krankenkassenprämien für die Grundversicherung – offizielle BAG-Daten.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${roboto.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
