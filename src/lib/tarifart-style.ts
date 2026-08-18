// Model-tag badge color per Tarifart, matching mockups/main.html's .model-tag.hmo/.telmed/.haus
// (hausarzt maps to the mockup's "haus" class — same success-container treatment). Shared
// between PlanRow's summary badge and ProductList's per-product detail rows.
export const MODEL_TAG_CLASSES: Record<string, string> = {
  hmo: "bg-warning-container text-on-warning-container",
  telmed: "bg-tertiary-container text-on-tertiary-container",
  hausarzt: "bg-success-container text-on-success-container",
};
export const DEFAULT_MODEL_TAG_CLASSES = "bg-surface-variant text-on-surface-variant";
