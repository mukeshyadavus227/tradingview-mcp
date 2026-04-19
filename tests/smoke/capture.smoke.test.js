/**
 * Smoke tests — src/core/capture.js::captureScreenshot.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import { captureScreenshot } from '../../src/core/capture.js';

describe('core/capture.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_captureScreenshot_smoke_fullRegion');
  it.todo('test_captureScreenshot_smoke_chartRegion');
  it.todo('test_captureScreenshot_smoke_apiMethod');
});
