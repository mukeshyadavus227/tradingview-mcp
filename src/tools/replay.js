import { z } from 'zod';
import { wrapCall } from './_format.js';
import * as core from '../core/replay.js';

export function registerReplayTools(server) {
  server.tool('replay_start', 'Start bar replay mode, optionally at a specific date', {
    date: z.string().optional().describe('Date to start replay from (YYYY-MM-DD format). If omitted, selects first available date.'),
  }, async ({ date }) => {
    return wrapCall(() => core.start({ date }));
  });

  server.tool('replay_step', 'Advance one bar in replay mode', {}, async () => {
    return wrapCall(() => core.step());
  });

  server.tool('replay_autoplay', 'Toggle autoplay in replay mode, optionally set speed', {
    speed: z.coerce.number().optional().describe('Autoplay delay in ms (lower = faster). Valid values: 100, 143, 200, 300, 1000, 2000, 3000, 5000, 10000. Leave empty to just toggle.'),
  }, async ({ speed }) => {
    return wrapCall(() => core.autoplay({ speed }));
  });

  server.tool('replay_stop', 'Stop replay and return to realtime', {}, async () => {
    return wrapCall(() => core.stop());
  });

  server.tool('replay_trade', 'Execute a trade action in replay mode (buy, sell, or close position)', {
    action: z.string().describe('Trade action: buy, sell, or close'),
  }, async ({ action }) => {
    return wrapCall(() => core.trade({ action }));
  });

  server.tool('replay_status', 'Get current replay mode status', {}, async () => {
    return wrapCall(() => core.status());
  });
}
