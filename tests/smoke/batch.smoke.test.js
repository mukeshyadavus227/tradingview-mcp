/**
 * Smoke tests — src/core/batch.js::batchRun.
 * Pure helpers (buildBatchPlan, summarizeBatchResults, buildBatchScreenshotName)
 * already unit-tested.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as batch from '../../src/core/batch.js';
import { memoryReporter } from '../../src/progress.js';

// Stable chart-ready state so waitForChartReady settles after ~3 polls.
// currentSymbol='' short-circuits the symbol-match check for any symbol.
const READY_STATE = { isLoading: false, barCount: 50, currentSymbol: '' };

describe('core/batch.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it('test_batchRun_smoke_ohlcv', async () => {
    installCdpMocks({
      getChartCollection: async () => 'window.cwc',
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => READY_STATE,                    // setSymbol + waitForChartReady polls
      evaluateAsync: async () => ({ bar_count: 100, last_bar: { close: 190 } }),
    });
    const r = await batch.batchRun({
      symbols: ['AAPL'], action: 'get_ohlcv', delay_ms: 10, ohlcv_count: 100,
    });
    assert.equal(r.success, true);
    assert.equal(r.total_iterations, 1);
    assert.equal(r.successful, 1);
    assert.equal(r.results[0].result.bar_count, 100);
  });

  it('test_batchRun_smoke_progressReporter', async () => {
    const reporter = memoryReporter();
    installCdpMocks({
      getChartCollection: async () => 'window.cwc',
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => READY_STATE,
      evaluateAsync: async () => ({ bar_count: 10, last_bar: {} }),
    });
    await batch.batchRun({
      symbols: ['AAPL', 'MSFT'], action: 'get_ohlcv', delay_ms: 10, progress: reporter,
    });
    // At least one log (start) and three updates (2 iteration starts + final 'done')
    const updates = reporter.events.filter(e => e.type === 'update');
    const logs = reporter.events.filter(e => e.type === 'log');
    assert.ok(logs.length >= 1, 'expected start log');
    assert.ok(updates.length >= 2, 'expected per-iteration updates');
    // Last update should be complete
    assert.equal(updates[updates.length - 1].pct, 1);
  });
});
