/**
 * CLI handler unit tests — invoke registered handlers directly with
 * CDP mocked via installCdpMocks. Complements tests/cli_commands.test.js
 * which black-box tests the CLI binary via execFileSync.
 *
 * By importing each command file we trigger its register() calls. We
 * then reach into the router's registry via _getCommand to grab the
 * exact handler a live `tv` invocation would run.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from './helpers/mock-cdp.js';

// Side-effect: each file calls register(). Load them all.
import '../src/cli/commands/health.js';
import '../src/cli/commands/chart.js';
import '../src/cli/commands/data.js';
import '../src/cli/commands/pine.js';
import '../src/cli/commands/capture.js';
import '../src/cli/commands/replay.js';
import '../src/cli/commands/drawing.js';
import '../src/cli/commands/alerts.js';
import '../src/cli/commands/watchlist.js';
import '../src/cli/commands/layout.js';
import '../src/cli/commands/indicator.js';
import '../src/cli/commands/ui.js';
import '../src/cli/commands/pane.js';
import '../src/cli/commands/tab.js';
import { _getCommand } from '../src/cli/router.js';

function h(...path) {
  const cmd = _getCommand(...path);
  if (!cmd) throw new Error(`no command registered at: ${path.join(' ')}`);
  return cmd.handler;
}

describe('CLI handlers — mocked CDP', () => {
  afterEach(() => resetCdpMocks());

  it('state', async () => {
    installCdpMocks({ evaluate: async () => ({ symbol: 'AAPL', resolution: 'D', chartType: 1, studies: [] }) });
    const r = await h('state')({}, []);
    assert.equal(r.symbol, 'AAPL');
  });

  it('symbol <ticker> (set)', async () => {
    installCdpMocks({ evaluateAsync: async () => undefined });
    // setSymbol path uses _deps — the handler calls core.setSymbol without
    // _deps, so it falls through to the real connection.js which hits our
    // evaluateAsync override. waitForChartReady also flows through evaluate.
    installCdpMocks({
      evaluateAsync: async () => undefined,
      evaluate: async () => ({ isLoading: false, barCount: 50, currentSymbol: '' }),
    });
    const r = await h('symbol')({}, ['NVDA']);
    assert.equal(r.symbol, 'NVDA');
  });

  it('symbol (no arg → falls back to state)', async () => {
    installCdpMocks({ evaluate: async () => ({ symbol: 'TSLA', resolution: '5', chartType: 1, studies: [] }) });
    const r = await h('symbol')({}, []);
    assert.equal(r.symbol, 'TSLA');
  });

  it('timeframe <tf>', async () => {
    installCdpMocks({
      evaluate: async () => ({ isLoading: false, barCount: 50, currentSymbol: '' }),
    });
    const r = await h('timeframe')({}, ['15']);
    assert.equal(r.timeframe, '15');
  });

  it('type <name>', async () => {
    installCdpMocks({ evaluate: async () => undefined });
    const r = await h('type')({}, ['Candles']);
    assert.equal(r.success, true);
    assert.equal(r.type_num, 1);
  });

  it('search <query>', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ symbols: [] }) });
    try {
      const r = await h('search')({}, ['AAPL']);
      assert.equal(r.query, 'AAPL');
    } finally { globalThis.fetch = realFetch; }
  });

  it('search (no query → throws)', () => {
    assert.throws(() => h('search')({}, []), /Query required/);
  });

  it('scroll <date>', async () => {
    installCdpMocks({ evaluate: async () => 'D' });
    const r = await h('scroll')({}, ['2025-01-15']);
    assert.equal(r.date, '2025-01-15');
  });

  it('scroll (no date → throws)', () => {
    assert.throws(() => h('scroll')({}, []), /Date required/);
  });

  it('quote <symbol>', async () => {
    installCdpMocks({ evaluate: async () => ({ symbol: 'AAPL', last: 190, close: 190 }) });
    const r = await h('quote')({}, ['AAPL']);
    assert.equal(r.symbol, 'AAPL');
  });

  it('ohlcv --summary', async () => {
    installCdpMocks({
      evaluate: async () => ({
        bars: [{ time: 1, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
               { time: 2, open: 104, high: 110, low: 103, close: 108, volume: 1500 }],
        total_bars: 100, source: 'direct_bars',
      }),
    });
    const r = await h('ohlcv')({ summary: true });
    assert.equal(r.success, true);
    assert.equal(r.high, 110);
  });

  it('values', async () => {
    installCdpMocks({ evaluate: async () => [] });
    const r = await h('values')({}, []);
    assert.equal(r.study_count, 0);
  });

  it('data lines', async () => {
    installCdpMocks({ evaluate: async () => [] });
    const r = await h('data', 'lines')({}, []);
    assert.equal(r.study_count, 0);
  });

  it('data indicator <id>', async () => {
    installCdpMocks({ evaluate: async () => ({ visible: true, inputs: [] }) });
    const r = await h('data', 'indicator')({}, ['eFu1Ot']);
    assert.equal(r.entity_id, 'eFu1Ot');
  });

  it('data indicator (no id → throws)', () => {
    assert.throws(() => h('data', 'indicator')({}, []), /Entity ID required/);
  });

  it('pine compile (smart)', async () => {
    let call = 0;
    installCdpMocks({
      evaluate: async () => {
        call++;
        if (call === 1) return true;     // ensurePineEditorOpen
        if (call === 2) return 3;         // studiesBefore
        if (call === 3) return 'Add to chart';
        if (call === 4) return [];        // errors
        return 4;                         // studiesAfter
      },
    });
    const r = await h('pine', 'compile')({}, []);
    assert.equal(r.button_clicked, 'Add to chart');
    assert.equal(r.study_added, true);
  });

  it('pine new <type>', async () => {
    installCdpMocks({ evaluate: async () => true });
    const r = await h('pine', 'new')({}, ['strategy']);
    assert.equal(r.type, 'strategy');
  });

  it('draw list', async () => {
    installCdpMocks({
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => [],
    });
    const r = await h('draw', 'list')({}, []);
    assert.equal(r.count, 0);
  });

  it('draw clear', async () => {
    installCdpMocks({
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => undefined,
    });
    const r = await h('draw', 'clear')({}, []);
    assert.equal(r.action, 'all_shapes_removed');
  });

  it('alert list', async () => {
    installCdpMocks({ evaluateAsync: async () => ({ alerts: [] }) });
    const r = await h('alert', 'list')({}, []);
    assert.equal(r.alert_count, 0);
  });

  it('alert delete (defaults to delete_all=true via CLI flag)', async () => {
    installCdpMocks({ evaluate: async () => ({ context_menu_opened: true }) });
    const r = await h('alert', 'delete')({ all: true }, []);
    assert.equal(r.success, true);
  });

  it('replay status', async () => {
    installCdpMocks({
      getReplayApi: async () => 'window.rp',
      evaluate: async () => ({ started: true, currentDate: 1700000000, position: 0 }),
    });
    const r = await h('replay', 'status')({}, []);
    assert.equal(r.success, true);
  });

  it('ui-state', async () => {
    installCdpMocks({ evaluate: async () => ({ bottom_panel: { open: true }, buttons: {}, chart: {} }) });
    const r = await h('ui-state')({}, []);
    assert.equal(r.success, true);
  });

  it('unknown command returns undefined via _getCommand', () => {
    assert.equal(_getCommand('nonexistent'), undefined);
    assert.equal(_getCommand('pine', 'nonexistent-sub'), undefined);
  });
});
