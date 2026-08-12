"use client";

type Props = {
  year: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  altModelsActive: boolean;
  onToggleAltModels: () => void;
  unfalldeckung: boolean;
  onToggleUnfalldeckung: () => void;
};

export function FilterBar({
  year,
  availableYears,
  onYearChange,
  altModelsActive,
  onToggleAltModels,
  unfalldeckung,
  onToggleUnfalldeckung,
}: Props) {
  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap">
      <span className="text-sm text-on-surface-variant mr-1">Jahr:</span>
      <div className="flex rounded-md border border-outline-variant overflow-hidden">
        {availableYears.map((y, i) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            aria-pressed={year === y}
            className={`px-3.5 py-1.5 text-sm ${i > 0 ? "border-l border-outline-variant" : ""} ${
              year === y ? "bg-primary text-on-primary font-semibold" : "bg-surface text-on-surface-variant"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="w-px h-6 bg-outline-variant mx-1" />
      <button
        type="button"
        role="button"
        aria-pressed={altModelsActive}
        onClick={onToggleAltModels}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          altModelsActive ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${altModelsActive ? "bg-primary" : "bg-outline"}`} />
        Alternative Modelle: {altModelsActive ? "ein" : "aus"}
      </button>
      <button
        type="button"
        role="button"
        aria-pressed={unfalldeckung}
        onClick={onToggleUnfalldeckung}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          unfalldeckung ? "bg-primary-container border-primary-container text-primary font-semibold" : "border-outline-variant text-on-surface-variant"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${unfalldeckung ? "bg-primary" : "bg-outline"}`} />
        Unfall: {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"}
      </button>
    </div>
  );
}
