/**
 * Smoke tests — src/wait.js::waitForChartReady.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import { waitForChartReady } from '../../src/wait.js';

describe('wait.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_waitForChartReady_smoke_ready');
  it.todo('test_waitForChartReady_smoke_timeout');
  it.todo('test_waitForChartReady_smoke_symbolMismatch');
});
