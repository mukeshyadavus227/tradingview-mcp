/**
 * Smoke tests — src/core/watchlist.js.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as watchlist from '../../src/core/watchlist.js';

describe('core/watchlist.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_get_smoke');
  it.todo('test_add_smoke');
});
