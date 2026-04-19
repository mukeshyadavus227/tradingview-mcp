/**
 * Smoke tests — src/core/pane.js.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as pane from '../../src/core/pane.js';

describe('core/pane.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_list_smoke');
  it.todo('test_setLayout_smoke_validCode');
  it.todo('test_setLayout_smoke_alias');
  it.todo('test_setLayout_smoke_unknown');
  it.todo('test_focus_smoke');
  it.todo('test_setSymbol_smoke');
});
