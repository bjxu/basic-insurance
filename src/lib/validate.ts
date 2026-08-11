// Inline validation for the two required free-form inputs (requirement.md REQ-13).

const CURRENT_YEAR = new Date().getFullYear();
const MAX_PLAUSIBLE_AGE = 120;

export type ValidationResult = { valid: true } | { valid: false; message: string };

export function validatePlz(raw: string): ValidationResult {
  if (!/^\d{4}$/.test(raw.trim())) {
    return { valid: false, message: "Ungültige PLZ — bitte eine vierstellige Schweizer PLZ eingeben." };
  }
  return { valid: true };
}

export function validateBirthYear(raw: number): ValidationResult {
  if (!Number.isInteger(raw)) {
    return { valid: false, message: "Bitte einen gültigen Jahrgang eingeben." };
  }
  if (raw > CURRENT_YEAR) {
    return { valid: false, message: "Jahrgang liegt in der Zukunft." };
  }
  if (CURRENT_YEAR - raw > MAX_PLAUSIBLE_AGE) {
    return { valid: false, message: "Bitte einen realistischen Jahrgang eingeben (max. ~120 Jahre)." };
  }
  return { valid: true };
}
