// Inline validation for the two required free-form inputs (requirement.md REQ-13).
// Returns error *codes*, not display text — callers translate the code via
// next-intl's `validation` message namespace (src/messages/{locale}.json), since this
// pure lib module has no business owning display text once there's more than one
// language to display it in.

const CURRENT_YEAR = new Date().getFullYear();
const MAX_PLAUSIBLE_AGE = 120;

export type ValidationErrorCode =
  | "invalidPlzFormat"
  | "invalidPremium"
  | "nonPositivePremium"
  | "invalidBirthYear"
  | "futureBirthYear"
  | "unrealisticBirthYear";

export type ValidationResult = { valid: true } | { valid: false; code: ValidationErrorCode };

export function validatePlz(raw: string): ValidationResult {
  if (!/^\d{4}$/.test(raw.trim())) {
    return { valid: false, code: "invalidPlzFormat" };
  }
  return { valid: true };
}

export function validateCurrentPremium(raw: number): ValidationResult {
  if (!Number.isFinite(raw)) {
    return { valid: false, code: "invalidPremium" };
  }
  if (raw <= 0) {
    return { valid: false, code: "nonPositivePremium" };
  }
  return { valid: true };
}

export function validateBirthYear(raw: number): ValidationResult {
  if (!Number.isInteger(raw)) {
    return { valid: false, code: "invalidBirthYear" };
  }
  if (raw > CURRENT_YEAR) {
    return { valid: false, code: "futureBirthYear" };
  }
  if (CURRENT_YEAR - raw > MAX_PLAUSIBLE_AGE) {
    return { valid: false, code: "unrealisticBirthYear" };
  }
  return { valid: true };
}
