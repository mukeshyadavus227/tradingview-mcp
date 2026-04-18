/**
 * Unit tests for the MCP tools wrapper layer (src/tools/*.js).
 *
 * Uses a spy `server` that records each `server.tool(name, desc, schema, handler)`
 * call so we can assert the registered surface — names, descriptions, zod schemas
 * — without a live MCP client. Handlers are also invoked end-to-end for the tools
 * whose core counterpart does not require CDP (e.g. pine_analyze).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { jsonResult } from '../src/tools/_format.js';
import { registerChartTools } from '../src/tools/chart.js';
import { registerDataTools } from '../src/tools/data.js';
import { registerPineTools } from '../src/tools/pine.js';
import { registerReplayTools } from '../src/tools/replay.js';
import { registerDrawingTools } from '../src/tools/drawing.js';
import { registerAlertTools } from '../src/tools/alerts.js';
import { registerIndicatorTools } from '../src/tools/indicators.js';
import { registerCaptureTools } from '../src/tools/capture.js';
import { registerHealthTools } from '../src/tools/health.js';
import { registerUiTools } from '../src/tools/ui.js';
import { registerPaneTools } from '../src/tools/pane.js';
import { registerTabTools } from '../src/tools/tab.js';
import { registerBatchTools } from '../src/tools/batch.js';
import { registerWatchlistTools } from '../src/tools/watchlist.js';

// ── Spy server ──────────────────────────────────────────────────────────

function spyServer() {
  const tools = new Map();
  return {
    tools,
    tool(name, description, schema, handler) {
      tools.set(name, { name, description, schema, handler });
    },
  };
}

// ── jsonResult ──────────────────────────────────────────────────────────

describe('jsonResult() — MCP response shape', () => {
  it('wraps object as a single text-content message', () => {
    const r = jsonResult({ ok: true, value: 42 });
    assert.equal(r.content.length, 1);
    assert.equal(r.content[0].type, 'text');
    const parsed = JSON.parse(r.content[0].text);
    assert.deepEqual(parsed, { ok: true, value: 42 });
  });

  it('pretty-prints JSON with 2-space indent', () => {
    const r = jsonResult({ a: 1 });
    assert.match(r.content[0].text, /\{\n  "a": 1\n\}/);
  });

  it('omits isError when not specified', () => {
    const r = jsonResult({});
    assert.ok(!('isError' in r));
  });

  it('sets isError:true when explicit error', () => {
    const r = jsonResult({ success: false, error: 'x' }, true);
    assert.equal(r.isError, true);
  });

  it('handles null and arrays', () => {
    assert.equal(JSON.parse(jsonResult(null).content[0].text), null);
    assert.deepEqual(JSON.parse(jsonResult([1, 2, 3]).content[0].text), [1, 2, 3]);
  });
});

// ── Registered tool surface — regression lock ───────────────────────────

const expectedTools = {
  chart: ['chart_get_state', 'chart_set_symbol', 'chart_set_timeframe', 'chart_set_type', 'chart_manage_indicator', 'chart_get_visible_range', 'chart_set_visible_range', 'chart_scroll_to_date', 'symbol_info', 'symbol_search'],
  data:  ['data_get_ohlcv', 'data_get_indicator', 'data_get_strategy_results', 'data_get_trades', 'data_get_equity', 'quote_get', 'depth_get', 'data_get_pine_lines', 'data_get_pine_labels', 'data_get_pine_tables', 'data_get_pine_boxes', 'data_get_study_values'],
  pine:  ['pine_get_source', 'pine_set_source', 'pine_compile', 'pine_get_errors', 'pine_save', 'pine_get_console', 'pine_smart_compile', 'pine_new', 'pine_open', 'pine_list_scripts', 'pine_analyze', 'pine_check'],
  replay: ['replay_start', 'replay_step', 'replay_autoplay', 'replay_stop', 'replay_trade', 'replay_status'],
  drawing: ['draw_shape', 'draw_list', 'draw_clear', 'draw_remove_one', 'draw_get_properties'],
  alerts: ['alert_create', 'alert_list', 'alert_delete'],
  indicators: ['indicator_set_inputs', 'indicator_toggle_visibility'],
  capture: ['capture_screenshot'],
};

describe('tool registration — regression lock on tool names', () => {
  for (const [mod, names] of Object.entries(expectedTools)) {
    it(`${mod} registers expected tool names`, () => {
      const server = spyServer();
      const registerFn = {
        chart: registerChartTools,
        data: registerDataTools,
        pine: registerPineTools,
        replay: registerReplayTools,
        drawing: registerDrawingTools,
        alerts: registerAlertTools,
        indicators: registerIndicatorTools,
        capture: registerCaptureTools,
      }[mod];
      registerFn(server);
      for (const name of names) {
        assert.ok(server.tools.has(name), `expected tool "${name}" to be registered by ${mod}`);
      }
      // Also assert no unexpected extras — catches silent additions
      const extras = [...server.tools.keys()].filter(n => !names.includes(n));
      assert.deepEqual(extras, [], `unexpected tools registered by ${mod}: ${extras.join(', ')}`);
    });
  }
});

describe('smoke — all non-data tool modules register at least one tool', () => {
  for (const [mod, register] of [
    ['health', registerHealthTools], ['ui', registerUiTools],
    ['pane', registerPaneTools], ['tab', registerTabTools],
    ['batch', registerBatchTools], ['watchlist', registerWatchlistTools],
  ]) {
    it(`${mod}`, () => {
      const server = spyServer();
      register(server);
      assert.ok(server.tools.size > 0, `${mod} registered no tools`);
    });
  }
});

// ── Tool descriptions + schemas ─────────────────────────────────────────

describe('chart_set_symbol schema', () => {
  const server = spyServer();
  registerChartTools(server);
  const tool = server.tools.get('chart_set_symbol');

  it('exists with a descriptive description', () => {
    assert.ok(tool);
    assert.ok(tool.description.length > 0);
  });

  it('requires `symbol` string', () => {
    assert.ok('symbol' in tool.schema);
    // zod v3 shape: symbol field is a ZodString
    const parsed = tool.schema.symbol.safeParse('AAPL');
    assert.equal(parsed.success, true);
    assert.equal(tool.schema.symbol.safeParse(123).success, false);
  });
});

describe('data_get_ohlcv schema', () => {
  const server = spyServer();
  registerDataTools(server);
  const tool = server.tools.get('data_get_ohlcv');

  it('count is optional numeric (coerced)', () => {
    assert.ok(tool.schema.count);
    assert.equal(tool.schema.count.safeParse(undefined).success, true);
    // z.coerce.number() → '100' becomes 100
    const parsed = tool.schema.count.safeParse('100');
    assert.equal(parsed.success, true);
    assert.equal(parsed.data, 100);
  });

  it('summary is optional boolean', () => {
    assert.ok(tool.schema.summary);
    assert.equal(tool.schema.summary.safeParse(true).success, true);
    assert.equal(tool.schema.summary.safeParse(undefined).success, true);
  });
});

describe('chart_manage_indicator enforces action enum', () => {
  const server = spyServer();
  registerChartTools(server);
  const tool = server.tools.get('chart_manage_indicator');
  it('accepts add/remove', () => {
    assert.equal(tool.schema.action.safeParse('add').success, true);
    assert.equal(tool.schema.action.safeParse('remove').success, true);
  });
  it('rejects arbitrary action', () => {
    assert.equal(tool.schema.action.safeParse('delete').success, false);
  });
});

describe('pine_new enforces type enum', () => {
  const server = spyServer();
  registerPineTools(server);
  const tool = server.tools.get('pine_new');
  it('accepts indicator/strategy/library', () => {
    for (const t of ['indicator', 'strategy', 'library']) {
      assert.equal(tool.schema.type.safeParse(t).success, true);
    }
  });
  it('rejects unknown type', () => {
    assert.equal(tool.schema.type.safeParse('banana').success, false);
  });
});

describe('draw_shape validates point coordinates', () => {
  const server = spyServer();
  registerDrawingTools(server);
  const tool = server.tools.get('draw_shape');
  it('coerces numeric strings in point', () => {
    const parsed = tool.schema.point.safeParse({ time: '1700000000', price: '100.5' });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.time, 1700000000);
    assert.equal(parsed.data.price, 100.5);
  });
  it('rejects missing price in point', () => {
    assert.equal(tool.schema.point.safeParse({ time: 1 }).success, false);
  });
});

// ── End-to-end handler invocation for CDP-free tools ────────────────────

describe('pine_analyze handler runs without TradingView', () => {
  const server = spyServer();
  registerPineTools(server);
  const { handler } = server.tools.get('pine_analyze');

  it('returns MCP content with issue_count when given valid source', async () => {
    const result = await handler({ source: '//@version=6\nindicator("ok")\nplot(close)' });
    assert.ok(result.content);
    assert.ok(!result.isError);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.issue_count, 0);
  });

  it('flags array OOB', async () => {
    const src = '//@version=6\nindicator("oob")\na = array.new_int(3)\nx = array.get(a, 5)';
    const result = await handler({ source: src });
    const parsed = JSON.parse(result.content[0].text);
    assert.ok(parsed.issue_count >= 1);
    assert.match(parsed.diagnostics[0].message, /out of bounds/);
  });

  it('flags strategy.entry without strategy() declaration', async () => {
    const src = '//@version=6\nindicator("bad")\nstrategy.entry("Long", strategy.long)';
    const result = await handler({ source: src });
    const parsed = JSON.parse(result.content[0].text);
    assert.ok(parsed.diagnostics.some(d => /strategy\(\) declaration/.test(d.message)));
  });
});

// ── Error path: tool handlers return isError:true on core failure ───────

describe('error envelope — tool handlers return isError on core throw', () => {
  it('pine_analyze with bad input still returns content', async () => {
    const server = spyServer();
    registerPineTools(server);
    const { handler } = server.tools.get('pine_analyze');
    // core.analyze({source}) requires source.split — missing source throws
    const result = await handler({ source: undefined });
    assert.ok(result.content);
    assert.equal(result.isError, true);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error);
  });
});
