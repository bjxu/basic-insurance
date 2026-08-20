// src/components/admin/AdminNav.tsx
// Shared nav header for the (authenticated) admin dashboard — markup and copy
// match mockups/admin.html's <nav> exactly. Not shown on /admin/login (see
// Task 10 notes) — rendered directly by admin/page.tsx instead of layout.tsx.

import { logoutAction } from "@/app/admin/actions";

export function AdminNav() {
  return (
    <nav className="sticky top-0 z-10 h-[52px] flex items-center gap-3 px-6 bg-on-surface text-on-primary">
      <span className="text-title-large">Krankenkassenvergleich</span>
      <span className="text-[11px] px-[7px] py-0.5 rounded bg-on-surface-variant text-outline tracking-[.4px]">
        ADMIN
      </span>
      <div className="flex-1" />
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-[13px] text-outline px-2.5 py-[5px] rounded-[5px] border border-on-surface-variant bg-transparent hover:bg-on-surface-variant hover:text-on-primary"
        >
          Abmelden
        </button>
      </form>
    </nav>
  );
}
