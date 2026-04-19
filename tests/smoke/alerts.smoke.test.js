/**
 * Smoke tests — src/core/alerts.js.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as alerts from '../../src/core/alerts.js';

describe('core/alerts.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it('test_create_smoke', async () => {
    // evaluate call sequence: opened(btn click), priceSet, message-type (skipped), created
    let call = 0;
    installCdpMocks({
      evaluate: async () => {
        call++;
        if (call === 1) return true;   // Create Alert button clicked
        if (call === 2) return true;   // price input set
        return true;                   // Create button clicked
      },
    });
    const r = await alerts.create({ condition: 'crossing', price: 190.5 });
    assert.equal(r.success, true);
    assert.equal(r.price, 190.5);
    assert.equal(r.condition, 'crossing');
    assert.equal(r.price_set, true);
  });

  it('test_list_smoke', async () => {
    installCdpMocks({
      evaluateAsync: async () => ({
        alerts: [
          { alert_id: 1, symbol: 'AAPL', price: 190, type: 'price', active: true },
          { alert_id: 2, symbol: 'MSFT', price: 400, type: 'price', active: true },
        ],
      }),
    });
    const r = await alerts.list();
    assert.equal(r.success, true);
    assert.equal(r.alert_count, 2);
    assert.equal(r.alerts[0].symbol, 'AAPL');
  });

  it('test_deleteAlerts_smoke_all', async () => {
    installCdpMocks({ evaluate: async () => ({ context_menu_opened: true }) });
    const r = await alerts.deleteAlerts({ delete_all: true });
    assert.equal(r.success, true);
    assert.equal(r.context_menu_opened, true);
  });

  it('test_deleteAlerts_smoke_single', async () => {
    await assert.rejects(
      alerts.deleteAlerts({ delete_all: false }),
      /not yet supported/,
    );
  });
});
