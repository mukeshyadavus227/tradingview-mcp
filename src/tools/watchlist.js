import { z } from 'zod';
import { wrapCall, jsonResult } from './_format.js';
import * as core from '../core/watchlist.js';
import { classifyError } from '../errors.js';

export function registerWatchlistTools(server) {
  server.tool('watchlist_get', 'Get all symbols from the current TradingView watchlist with last price, change, and change%', {},
    () => wrapCall(() => core.get()));

  server.tool('watchlist_add', 'Add a symbol to the TradingView watchlist', {
    symbol: z.string().describe('Symbol to add (e.g., AAPL, BTCUSD, ES1!, NYMEX:CL1!)'),
  }, async ({ symbol }) => {
    try {
      return jsonResult(await core.add({ symbol }));
    } catch (err) {
      // Best-effort: close any open search/input on error.
      try {
        const { getClient } = await import('../connection.js');
        const c = await getClient();
        await c.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await c.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      } catch { /* ignore */ }
      return jsonResult(classifyError(err).toJSON(), true);
    }
  });
}
