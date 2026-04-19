/**
 * Smoke tests — src/core/data.js.
 * Pure helpers (summarizeBars, processPine*, clampBarCount, etc.) are
 * already unit-tested. These cover the async CDP-dependent exports.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as data from '../../src/core/data.js';

describe('core/data.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_getOhlcv_smoke_default');
  it.todo('test_getOhlcv_smoke_summary');
  it.todo('test_getOhlcv_smoke_emptyBars');
  it.todo('test_getIndicator_smoke');
  it.todo('test_getIndicator_smoke_notFound');
  it.todo('test_getStrategyResults_smoke');
  it.todo('test_getTrades_smoke');
  it.todo('test_getEquity_smoke');
  it.todo('test_getQuote_smoke');
  it.todo('test_getQuote_smoke_emptyFails');
  it.todo('test_getDepth_smoke');
  it.todo('test_getStudyValues_smoke');
  it.todo('test_getPineLines_smoke');
  it.todo('test_getPineLabels_smoke');
  it.todo('test_getPineTables_smoke');
  it.todo('test_getPineBoxes_smoke');
});
