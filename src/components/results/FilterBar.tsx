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
      <span className="text-sm text-gray-500 mr-1">Jahr:</span>
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        {availableYears.map((y, i) => (
          <button
            key={y}
            type="button"
            onClick={() => onYearChange(y)}
            aria-pressed={year === y}
            className={`px-3.5 py-1.5 text-sm ${i > 0 ? "border-l border-gray-200" : ""} ${
              year === y ? "bg-blue-600 text-white font-semibold" : "bg-white text-gray-600"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        type="button"
        role="button"
        aria-pressed={altModelsActive}
        onClick={onToggleAltModels}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          altModelsActive ? "bg-blue-50 border-blue-300 text-blue-600 font-semibold" : "border-gray-200 text-gray-600"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${altModelsActive ? "bg-blue-600" : "bg-gray-300"}`} />
        Alternative Modelle: {altModelsActive ? "ein" : "aus"}
      </button>
      <button
        type="button"
        role="button"
        aria-pressed={unfalldeckung}
        onClick={onToggleUnfalldeckung}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${
          unfalldeckung ? "bg-blue-50 border-blue-300 text-blue-600 font-semibold" : "border-gray-200 text-gray-600"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${unfalldeckung ? "bg-blue-600" : "bg-gray-300"}`} />
        Unfall: {unfalldeckung ? "eingeschlossen" : "ausgeschlossen"}
      </button>
    </div>
  );
}
