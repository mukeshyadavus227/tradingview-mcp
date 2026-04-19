/**
 * Smoke tests — src/core/batch.js::batchRun.
 * Pure helpers (buildBatchPlan, summarizeBatchResults, buildBatchScreenshotName)
 * already unit-tested.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as batch from '../../src/core/batch.js';

describe('core/batch.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_batchRun_smoke_ohlcv');
  it.todo('test_batchRun_smoke_progressReporter');
});
