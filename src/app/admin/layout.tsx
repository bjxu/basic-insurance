import type { Metadata } from "next";

// REQ-22: /admin is not publicly linked or indexed.
export const metadata: Metadata = {
  title: "Admin – Krankenkassenvergleich",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
