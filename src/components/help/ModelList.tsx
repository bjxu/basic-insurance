"use client";

import { useTranslations } from "next-intl";

// The BAG-classified Tarifart set, shared by the models ⓘ popover and the
// how-it-works guide's "models" section. Copy comes from the same
// `copy.tarifart.*` catalog the result rows already use.
const MODEL_KEYS = ["standard", "hausarzt", "telmed", "hmo", "andere"] as const;

export function ModelList({ className = "" }: { className?: string }) {
  const t = useTranslations("copy.tarifart");

  return (
    <dl className={`space-y-1 ${className}`}>
      {MODEL_KEYS.map((key) => (
        <div key={key} className="text-xs leading-relaxed">
          <dt className="inline font-semibold text-on-surface">{t(`${key}.label`)}:</dt>{" "}
          <dd className="inline text-on-surface-variant">{t(`${key}.description`)}</dd>
        </div>
      ))}
    </dl>
  );
}
