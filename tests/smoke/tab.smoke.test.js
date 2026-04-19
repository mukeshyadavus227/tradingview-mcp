/**
 * Smoke tests — src/core/tab.js::list.
 * newTab/closeTab/switchTab flagged: they dispatch real keyboard events
 * and hit http://localhost:9222/json/*, which needs more than a 10-line
 * mock. They belong in a real integration test, not a smoke test.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as tab from '../../src/core/tab.js';

describe('core/tab.js — smoke', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it.todo('test_list_smoke');
});
