/**
 * Unit tests for pure helpers in src/core/batch.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildBatchPlan, summarizeBatchResults, buildBatchScreenshotName } from '../src/core/batch.js';

describe('buildBatchPlan()', () => {
  it('empty symbols returns empty plan', () => {
    assert.deepEqual(buildBatchPlan([]), []);
    assert.deepEqual(buildBatchPlan(null), []);
  });

  it('one symbol, no timeframes → single default-tf entry', () => {
    assert.deepEqual(buildBatchPlan(['AAPL']), [{ symbol: 'AAPL', timeframe: null }]);
  });

  it('cartesian product of symbols × timeframes', () => {
    const plan = buildBatchPlan(['AAPL', 'MSFT'], ['5', '60']);
    assert.equal(plan.length, 4);
    assert.deepEqual(plan[0], { symbol: 'AAPL', timeframe: '5' });
    assert.deepEqual(plan[1], { symbol: 'AAPL', timeframe: '60' });
    assert.deepEqual(plan[2], { symbol: 'MSFT', timeframe: '5' });
    assert.deepEqual(plan[3], { symbol: 'MSFT', timeframe: '60' });
  });

  it('treats empty timeframes array as default', () => {
    assert.deepEqual(buildBatchPlan(['X'], []), [{ symbol: 'X', timeframe: null }]);
  });
});

describe('summarizeBatchResults()', () => {
  it('counts successes and failures', () => {
    const r = summarizeBatchResults([
      { success: true }, { success: false }, { success: true },
    ]);
    assert.equal(r.total_iterations, 3);
    assert.equal(r.successful, 2);
    assert.equal(r.failed, 1);
    assert.equal(r.success, true);
  });

  it('preserves the raw results array', () => {
    const raw = [{ success: true, symbol: 'X' }];
    const r = summarizeBatchResults(raw);
    assert.equal(r.results, raw);
  });

  it('handles empty results', () => {
    const r = summarizeBatchResults([]);
    assert.equal(r.total_iterations, 0);
    assert.equal(r.successful, 0);
    assert.equal(r.failed, 0);
  });
});

describe('buildBatchScreenshotName()', () => {
  const d = new Date('2025-03-15T01:02:03.004Z');
  it('embeds symbol, timeframe and timestamp', () => {
    assert.equal(buildBatchScreenshotName('AAPL', '5', d), 'batch_AAPL_5_2025-03-15T01-02-03-004Z.png');
  });
  it('defaults timeframe to "default"', () => {
    assert.equal(buildBatchScreenshotName('AAPL', null, d), 'batch_AAPL_default_2025-03-15T01-02-03-004Z.png');
  });
  it('strips path separators', () => {
    const n = buildBatchScreenshotName('AAPL/../../etc', '5', d);
    assert.ok(!n.includes('/'));
  });
});
