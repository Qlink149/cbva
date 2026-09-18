import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isActionOverdue } from './isActionOverdue.js';

describe('isActionOverdue', () => {
  it('returns false when no deadline', () => {
    assert.equal(isActionOverdue(null, 'Pending'), false);
  });

  it('returns false for completed status', () => {
    assert.equal(isActionOverdue('2020-01-01', 'Completed'), false);
  });

  it('compares calendar dates in IST', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.toISOString().slice(0, 10);
    assert.equal(isActionOverdue(y, 'Pending'), true);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const t = tomorrow.toISOString().slice(0, 10);
    assert.equal(isActionOverdue(t, 'Pending'), false);
  });
});
