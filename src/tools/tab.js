import { z } from 'zod';
import { wrapCall } from './_format.js';
import * as core from '../core/tab.js';

export function registerTabTools(server) {
  server.tool('tab_list', 'List all open TradingView chart tabs', {}, async () => {
    return wrapCall(() => core.list());
  });

  server.tool('tab_new', 'Open a new chart tab', {}, async () => {
    return wrapCall(() => core.newTab());
  });

  server.tool('tab_close', 'Close the current chart tab', {}, async () => {
    return wrapCall(() => core.closeTab());
  });

  server.tool('tab_switch', 'Switch to a chart tab by index', {
    index: z.coerce.number().describe('Tab index (0-based, from tab_list)'),
  }, async ({ index }) => {
    return wrapCall(() => core.switchTab({ index }));
  });
}
