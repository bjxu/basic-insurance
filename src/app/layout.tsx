import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
