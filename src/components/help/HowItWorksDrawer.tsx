"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HowItWorksContent } from "./HowItWorksContent";

// On-page slide-over (spec §"Drawer"). The comparator stays mounted underneath.
// Esc / scrim / ✕ close it; body scroll is locked while open; focus moves to ✕
// on open and returns to the opener on close. Not a full focus trap — a known
// v1 simplification noted in the spec's Testing section.
export function HowItWorksDrawer({
  open,
  section,
  onClose,
}: {
  open: boolean;
  section?: string;
  onClose: () => void;
}) {
  const t = useTranslations("help");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    closeRef.current?.focus();

    // Jump the panel to the requested section when opened from an ⓘ's "full
    // explainer" link; the top otherwise.
    if (section) {
      panelRef.current?.querySelector(`#${section}`)?.scrollIntoView({ block: "start" });
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, section, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.32)]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("drawer.title")}
        className="absolute right-0 top-0 bottom-0 w-[min(420px,92vw)] overflow-y-auto border-l border-outline-variant bg-surface p-5 shadow-[-8px_0_28px_rgba(0,0,0,0.16)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("drawer.close")}
          className="absolute right-4 top-4 text-base text-on-surface-variant"
        >
          ✕
        </button>
        <HowItWorksContent />
        <Link
          href="/how-it-works"
          onClick={onClose}
          className="mt-4 inline-block text-[12.5px] font-semibold text-primary"
        >
          {t("drawer.readFull")}
        </Link>
      </div>
    </div>
  );
}
