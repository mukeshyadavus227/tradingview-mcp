/**
 * Unit tests for the pure helper in src/core/drawing.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOverrides } from '../src/core/drawing.js';
import { UserInputError } from '../src/errors.js';

describe('sanitizeOverrides()', () => {
  it('returns {} for null/undefined', () => {
    assert.deepEqual(sanitizeOverrides(null), {});
    assert.deepEqual(sanitizeOverrides(undefined), {});
  });

  it('accepts JSON strings', () => {
    const r = sanitizeOverrides('{"linecolor":"#ff0000","linewidth":2}');
    assert.deepEqual(r, { linecolor: '#ff0000', linewidth: 2 });
  });

  it('accepts plain objects', () => {
    assert.deepEqual(sanitizeOverrides({ linewidth: 3 }), { linewidth: 3 });
  });

  it('drops keys not in the allowlist', () => {
    const r = sanitizeOverrides({ linewidth: 2, __proto__: 'evil', customScript: 'alert(1)' });
    assert.ok(!('customScript' in r));
    assert.ok(!('__proto__' in r) || r.__proto__ !== 'evil');
  });

  it('rejects arrays', () => {
    assert.throws(() => sanitizeOverrides('[1,2,3]'), UserInputError);
  });

  it('rejects non-object primitives when parsed', () => {
    assert.throws(() => sanitizeOverrides('"a string"'), UserInputError);
    assert.throws(() => sanitizeOverrides('42'), UserInputError);
  });

  it('drops non-finite numbers', () => {
    const r = sanitizeOverrides({ linewidth: NaN, linestyle: Infinity, fontsize: 12 });
    assert.deepEqual(r, { fontsize: 12 });
  });

  it('drops objects and functions as values', () => {
    const r = sanitizeOverrides({ linecolor: { r: 1 }, linewidth: 2 });
    assert.deepEqual(r, { linewidth: 2 });
  });

  it('drops oversize strings', () => {
    const r = sanitizeOverrides({ linecolor: 'x'.repeat(100) });
    assert.deepEqual(r, {});
  });

  it('preserves booleans', () => {
    assert.deepEqual(sanitizeOverrides({ bold: true, italic: false }), { bold: true, italic: false });
  });

  it('allows well-known style keys', () => {
    const r = sanitizeOverrides({
      linecolor: '#f00', linewidth: 2, linestyle: 0,
      bordercolor: '#000', backgroundColor: '#fff', transparency: 50,
      textcolor: '#111', fontsize: 12, bold: true, italic: false,
      showLabel: true, extendLeft: false, extendRight: true,
    });
    assert.equal(Object.keys(r).length, 13);
  });
});
