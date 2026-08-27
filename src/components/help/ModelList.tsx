"use client";

import { useTranslations } from "next-intl";

// The alternative Tarifarts, nested under one "Alternative models" group.
// `standard` sits above the group. Copy comes from the same `copy.tarifart.*`
// catalog the result rows use; the group label from `help.terms.models.altGroup`.
const ALT_MODEL_KEYS = ["hausarzt", "telmed", "hmo"] as const;

function Row({ label, desc }: { label: string; desc: string }) {
  return (
    <p className="text-xs leading-relaxed">
      <span className="font-semibold text-on-surface">{label}:</span>{" "}
      <span className="text-on-surface-variant">{desc}</span>
    </p>
  );
}

export function ModelList({ className = "" }: { className?: string }) {
  const t = useTranslations("copy.tarifart");
  const tm = useTranslations("help.terms.models");

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Row label={t("standard.label")} desc={t("standard.description")} />
      <div>
        <span className="text-xs font-semibold text-on-surface">{tm("altGroup")}</span>
        <div className="mt-1 space-y-1 border-l border-outline-variant pl-3">
          {ALT_MODEL_KEYS.map((key) => (
            <Row key={key} label={t(`${key}.label`)} desc={t(`${key}.description`)} />
          ))}
        </div>
      </div>
    </div>
  );
}
