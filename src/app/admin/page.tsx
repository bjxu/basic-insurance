// src/app/admin/page.tsx
// Server component: resolves the initial range from URL search params
// (defaulting to last 30 days per architecture.md §13.3), renders the nav
// header and the client Dashboard.

import { AdminNav } from "@/components/admin/AdminNav";
import { Dashboard } from "@/components/admin/Dashboard";
import { presetRange } from "@/lib/adminRanges";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const defaultRange = presetRange("30d", new Date());

  const initialFrom = from && ISO_DATE.test(from) ? from : defaultRange.from;
  const initialTo = to && ISO_DATE.test(to) ? to : defaultRange.to;
  const usedDefault = initialFrom === defaultRange.from && initialTo === defaultRange.to && !from && !to;

  return (
    <>
      <AdminNav />
      <Dashboard initialFrom={initialFrom} initialTo={initialTo} initialPreset={usedDefault ? "30d" : null} />
    </>
  );
}
