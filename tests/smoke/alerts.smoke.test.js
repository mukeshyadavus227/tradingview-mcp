/**
 * Smoke tests — src/core/alerts.js.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as alerts from '../../src/core/alerts.js';

describe('core/alerts.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_create_smoke');
  it.todo('test_list_smoke');
  it.todo('test_deleteAlerts_smoke_all');
  it.todo('test_deleteAlerts_smoke_single');
});
