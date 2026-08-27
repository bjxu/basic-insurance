"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HELP_ANCHORS, type TermKey } from "@/lib/help";
import { ModelList } from "./ModelList";

// Layer 2 of the newcomer help (spec §"Inline help"). One <details> element:
// - the <summary> is the ⓘ button (keyboard-operable, toggles [open], which the
//   [details[open]_&] variants below key off for the active style + panel show);
// - the panel is an anchored popover from the `sm` breakpoint up, and an inline
//   disclosure (normal block flow, pushes content down) on narrow viewports.
// Esc and outside-click close it on all sizes.
// The "full explainer" link opens the how-it-works drawer (not a page nav),
// scrolled to this term's section.
export function HelpTip({ term, onOpenGuide }: { term: TermKey; onOpenGuide: (section?: string) => void }) {
  const t = useTranslations("help");
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  // Register the global close listeners only while the panel is open — with up to
  // ~37 HelpTips on the results page, always-live listeners would fire on every
  // keystroke for no reason.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;

    function close(e: Event) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && el && el.contains(e.target as Node)) return;
      if (el) el.open = false;
    }

    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <details
      ref={ref}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group inline-block align-middle"
    >
      <summary
        aria-label={`${t("tip.openLabel")}: ${t(`terms.${term}.title`)}`}
        className="inline-flex h-[15px] w-[15px] cursor-pointer select-none items-center justify-center rounded-full border border-outline bg-surface text-[10px] font-bold italic text-on-surface-variant list-none [&::-webkit-details-marker]:hidden [details[open]_&]:border-primary [details[open]_&]:bg-primary [details[open]_&]:text-on-primary"
      >
        i
      </summary>
      <div
        className="mt-2 w-full rounded-lg border border-outline-variant bg-surface p-3 text-left shadow-[0_4px_12px_rgba(0,0,0,0.08)] z-20 sm:absolute sm:left-0 sm:top-full sm:mt-1 sm:w-[min(20rem,calc(100vw-2rem))] sm:max-w-[calc(100vw-2rem)]"
      >
        <p className="text-[12.5px] font-bold text-on-surface">{t(`terms.${term}.title`)}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{t(`terms.${term}.short`)}</p>
        {term === "models" && <ModelList className="mt-2" />}
        <button
          type="button"
          onClick={() => {
            if (ref.current) ref.current.open = false;
            onOpenGuide(HELP_ANCHORS[term]);
          }}
          className="mt-2 inline-block text-[11.5px] font-semibold text-primary"
        >
          {t("tip.fullLink")}
        </button>
      </div>
    </details>
  );
}
