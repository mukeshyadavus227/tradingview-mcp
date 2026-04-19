/**
 * Smoke tests — src/core/health.js (launch flagged for real test, not smoke).
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as health from '../../src/core/health.js';

describe('core/health.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_healthCheck_smoke');
  it.todo('test_discover_smoke');
  it.todo('test_uiState_smoke');
  // launch() flagged: spawns process + probes CDP port. Needs real test, not smoke.
});
