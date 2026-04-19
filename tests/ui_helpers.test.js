/**
 * Unit tests for pure helpers in src/core/ui.js.
 * No TradingView / CDP required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { modifierMask, resolveKey, findLayoutMatch, scrollDelta, KEY_MAP } from '../src/core/ui.js';

describe('modifierMask()', () => {
  it('empty when no modifiers passed', () => {
    assert.equal(modifierMask(undefined), 0);
    assert.equal(modifierMask([]), 0);
  });
  it('alt=1, ctrl=2, meta=4, shift=8', () => {
    assert.equal(modifierMask(['alt']), 1);
    assert.equal(modifierMask(['ctrl']), 2);
    assert.equal(modifierMask(['meta']), 4);
    assert.equal(modifierMask(['shift']), 8);
  });
  it('combines bits', () => {
    assert.equal(modifierMask(['ctrl', 'shift']), 10);
    assert.equal(modifierMask(['alt', 'ctrl', 'meta', 'shift']), 15);
  });
  it('is case-insensitive', () => {
    assert.equal(modifierMask(['CTRL', 'Shift']), 10);
  });
  it('ignores unknown modifiers', () => {
    assert.equal(modifierMask(['hyper']), 0);
  });
});

describe('resolveKey()', () => {
  it('returns known keys from KEY_MAP', () => {
    assert.deepEqual(resolveKey('Enter'), KEY_MAP['Enter']);
    assert.deepEqual(resolveKey('Escape'), KEY_MAP['Escape']);
  });
  it('falls back for letter keys', () => {
    const r = resolveKey('a');
    assert.equal(r.code, 'KeyA');
    assert.equal(r.vk, 65);
  });
  it('handles empty input without crashing', () => {
    const r = resolveKey('');
    assert.equal(r.vk, 0);
  });
});

describe('findLayoutMatch()', () => {
  const charts = [
    { id: '1', name: 'Day Trading' },
    { id: '2', name: 'Long Term' },
    { id: '3', title: 'Crypto Only' },
  ];
  it('exact match wins', () => {
    assert.equal(findLayoutMatch(charts, 'Day Trading').id, '1');
  });
  it('case-insensitive exact match', () => {
    assert.equal(findLayoutMatch(charts, 'day trading').id, '1');
  });
  it('falls back to substring match', () => {
    assert.equal(findLayoutMatch(charts, 'term').id, '2');
  });
  it('matches against title when name missing', () => {
    assert.equal(findLayoutMatch(charts, 'crypto').id, '3');
  });
  it('returns null when nothing matches', () => {
    assert.equal(findLayoutMatch(charts, 'nope'), null);
  });
  it('returns null for empty charts or query', () => {
    assert.equal(findLayoutMatch([], 'x'), null);
    assert.equal(findLayoutMatch(charts, ''), null);
    assert.equal(findLayoutMatch(null, 'x'), null);
  });
});

describe('scrollDelta()', () => {
  it('up is negative Y', () => {
    assert.deepEqual(scrollDelta('up', 100), { deltaX: 0, deltaY: -100 });
  });
  it('down is positive Y', () => {
    assert.deepEqual(scrollDelta('down', 100), { deltaX: 0, deltaY: 100 });
  });
  it('left / right map to X axis', () => {
    assert.deepEqual(scrollDelta('left', 50), { deltaX: -50, deltaY: 0 });
    assert.deepEqual(scrollDelta('right', 50), { deltaX: 50, deltaY: 0 });
  });
  it('defaults amount to 300', () => {
    assert.deepEqual(scrollDelta('up'), { deltaX: 0, deltaY: -300 });
  });
  it('unknown direction returns zeros', () => {
    assert.deepEqual(scrollDelta('diagonal', 100), { deltaX: 0, deltaY: 0 });
  });
});
