// Swiss-convention monetary formatting (requirement.md §9): apostrophe thousands
// separator, two decimal places, "CHF" prefix.

export function formatChf(amount: number): string {
  const parts = amount.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${intPart}.${parts[1]}`;
}
