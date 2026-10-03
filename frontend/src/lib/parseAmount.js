/**
 * Forward-only amount parsing for INR whole-rupee fields.
 * Strips Indian/US grouping commas and spaces. Does NOT rescale historical DB values.
 */

/** @returns {number|null} rounded non-negative integer, or null if empty/invalid */
export function parseAmountInput(raw, { allowEmpty = false } = {}) {
  if (raw == null) return allowEmpty ? null : 0;
  const trimmed = String(raw).trim();
  if (trimmed === '') return allowEmpty ? null : 0;
  const cleaned = trimmed.replace(/[,\s]/g, '');
  if (cleaned === '' || cleaned === '-') return allowEmpty ? null : 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** Parse as rupees (table / Blue Sky edits). Invalid → null (caller keeps old value). */
export function parseRupeeInput(raw) {
  return parseAmountInput(raw, { allowEmpty: false });
}

const LAKH = 100_000;

/** Parse modal field entered in lakhs → whole rupees. */
export function parseLakhInputToRupees(raw) {
  const trimmed = String(raw ?? '').trim();
  // Comma-grouped input is rupee-formatted (e.g. 18,00,000), not lakhs.
  if (trimmed.includes(',')) {
    const rupees = parseRupeeInput(trimmed);
    return rupees ?? 0;
  }
  const lakhs = parseAmountInput(raw, { allowEmpty: false });
  if (lakhs == null) return 0;
  return Math.round(lakhs * LAKH);
}

/** Preview helper: lakhs draft → display rupees string (no DB write). */
export function lakhDraftToRupees(raw) {
  if (raw === '' || raw == null) return 0;
  return parseLakhInputToRupees(raw);
}
