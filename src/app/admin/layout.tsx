import type { Metadata } from "next";
import { RootShell, viewport } from "@/app/root-shell";

export { viewport };

// REQ-22: /admin is not publicly linked or indexed.
export const metadata: Metadata = {
  title: "Admin – Krankenkassenvergleich",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RootShell lang="de">{children}</RootShell>;
}
