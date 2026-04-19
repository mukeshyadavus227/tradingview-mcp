/**
 * Smoke tests — src/core/chart.js.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as chart from '../../src/core/chart.js';

describe('core/chart.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_getState_smoke');
  it.todo('test_setSymbol_smoke');
  it.todo('test_setTimeframe_smoke');
  it.todo('test_setType_smoke_byName');
  it.todo('test_setType_smoke_byNumber');
  it.todo('test_setType_smoke_invalid');
  it.todo('test_manageIndicator_smoke_add');
  it.todo('test_manageIndicator_smoke_remove');
  it.todo('test_manageIndicator_smoke_missingEntityId');
  it.todo('test_getVisibleRange_smoke');
  it.todo('test_setVisibleRange_smoke');
  it.todo('test_scrollToDate_smoke_iso');
  it.todo('test_scrollToDate_smoke_unix');
  it.todo('test_scrollToDate_smoke_invalid');
  it.todo('test_symbolInfo_smoke');
  it.todo('test_symbolSearch_smoke'); // mocks global fetch
});
