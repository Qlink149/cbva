import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountInput,
  parseRupeeInput,
  parseLakhInputToRupees,
  lakhDraftToRupees,
} from './parseAmount.js';

describe('parseAmountInput', () => {
  it('strips commas and spaces', () => {
    assert.equal(parseAmountInput('18,00,000'), 1800000);
    assert.equal(parseAmountInput('1 800 000'), 1800000);
  });

  it('returns null for invalid input', () => {
    assert.equal(parseAmountInput('abc'), null);
    assert.equal(parseAmountInput('-5'), null);
  });
});

describe('parseRupeeInput (table round-trip)', () => {
  it('preserves whole rupees', () => {
    assert.equal(parseRupeeInput('1800000'), 1800000);
    assert.equal(parseRupeeInput('18,00,000'), 1800000);
  });
});

describe('parseLakhInputToRupees (modal round-trip)', () => {
  it('converts lakhs to rupees', () => {
    assert.equal(parseLakhInputToRupees('18'), 1_800_000);
    assert.equal(parseLakhInputToRupees('180'), 18_000_000);
  });

  it('preview matches save', () => {
    assert.equal(lakhDraftToRupees('18'), parseLakhInputToRupees('18'));
  });
});
