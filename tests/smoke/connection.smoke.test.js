/**
 * Smoke tests — src/connection.js CDP path helpers and evaluate/getClient.
 * Uses installCdpMocks so we never touch a real CDP socket.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as conn from '../../src/connection.js';

describe('connection.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_getClient_smoke');
  it.todo('test_evaluate_smoke');
  it.todo('test_evaluateAsync_smoke');
  it.todo('test_getTargetInfo_smoke');
  it.todo('test_getChartApi_smoke');
  it.todo('test_getChartCollection_smoke');
  it.todo('test_getBottomBar_smoke');
  it.todo('test_getReplayApi_smoke');
  it.todo('test_getMainSeriesBars_smoke');
  it.todo('test_disconnect_smoke');
});
