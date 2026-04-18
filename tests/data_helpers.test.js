/**
 * Unit tests for pure helpers in src/core/data.js.
 * No CDP/TradingView required — exercises the offline post-processing
 * logic (summary stats, dedup, limits, table formatting).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampBarCount,
  clampTradeCount,
  summarizeBars,
  filterIndicatorInputs,
  processPineLines,
  processPineLabels,
  processPineTables,
  processPineBoxes,
  MAX_OHLCV_BARS,
  MAX_TRADES,
  DEFAULT_LABEL_LIMIT,
} from '../src/core/data.js';

// ── clampBarCount / clampTradeCount ─────────────────────────────────────

describe('clampBarCount()', () => {
  it('defaults to 100 when undefined', () => {
    assert.equal(clampBarCount(undefined), 100);
  });
  it('defaults to 100 when null or 0', () => {
    assert.equal(clampBarCount(null), 100);
    assert.equal(clampBarCount(0), 100);
  });
  it('caps at MAX_OHLCV_BARS (500)', () => {
    assert.equal(clampBarCount(10_000), MAX_OHLCV_BARS);
    assert.equal(clampBarCount(500), 500);
    assert.equal(clampBarCount(501), 500);
  });
  it('floors values below 1 to 1', () => {
    assert.equal(clampBarCount(-5), 1);
  });
  it('truncates floats', () => {
    assert.equal(clampBarCount(42.9), 42);
  });
  it('accepts numeric strings via coercion', () => {
    assert.equal(clampBarCount('200'), 200);
  });
});

describe('clampTradeCount()', () => {
  it('defaults to 20 when undefined', () => {
    assert.equal(clampTradeCount(undefined), 20);
  });
  it('caps at MAX_TRADES (20)', () => {
    assert.equal(clampTradeCount(100), MAX_TRADES);
  });
  it('allows 1', () => {
    assert.equal(clampTradeCount(1), 1);
  });
});

// ── summarizeBars ───────────────────────────────────────────────────────

describe('summarizeBars()', () => {
  const sample = [
    { time: 1, open: 100, high: 105, low: 99,  close: 104, volume: 1000 },
    { time: 2, open: 104, high: 110, low: 103, close: 108, volume: 1500 },
    { time: 3, open: 108, high: 112, low: 107, close: 111, volume: 2000 },
    { time: 4, open: 111, high: 113, low: 105, close: 106, volume: 800  },
    { time: 5, open: 106, high: 109, low: 100, close: 102, volume: 1200 },
    { time: 6, open: 102, high: 108, low: 101, close: 107, volume: 900  },
  ];

  it('computes high as the max across bars', () => {
    const r = summarizeBars(sample);
    assert.equal(r.high, 113);
  });
  it('computes low as the min across bars', () => {
    const r = summarizeBars(sample);
    assert.equal(r.low, 99);
  });
  it('range = high - low rounded to 2dp', () => {
    const r = summarizeBars(sample);
    assert.equal(r.range, 14);
  });
  it('change = last.close - first.open rounded to 2dp', () => {
    const r = summarizeBars(sample);
    assert.equal(r.change, 7);
  });
  it('change_pct is string with % suffix', () => {
    const r = summarizeBars(sample);
    assert.equal(typeof r.change_pct, 'string');
    assert.ok(r.change_pct.endsWith('%'));
    assert.equal(r.change_pct, '7%');
  });
  it('avg_volume rounded', () => {
    const r = summarizeBars(sample);
    // (1000+1500+2000+800+1200+900)/6 = 1233.33 → 1233
    assert.equal(r.avg_volume, 1233);
  });
  it('last_5_bars contains the trailing 5', () => {
    const r = summarizeBars(sample);
    assert.equal(r.last_5_bars.length, 5);
    assert.equal(r.last_5_bars[0].time, 2);
    assert.equal(r.last_5_bars[4].time, 6);
  });
  it('period.from and period.to come from first and last', () => {
    const r = summarizeBars(sample);
    assert.deepEqual(r.period, { from: 1, to: 6 });
  });
  it('handles missing volume by treating as 0', () => {
    const bars = [
      { time: 1, open: 1, high: 2, low: 1, close: 1 },
      { time: 2, open: 1, high: 2, low: 1, close: 1 },
    ];
    const r = summarizeBars(bars);
    assert.equal(r.avg_volume, 0);
  });
  it('throws on empty', () => {
    assert.throws(() => summarizeBars([]), /non-empty/);
  });
  it('throws on non-array', () => {
    assert.throws(() => summarizeBars(null), /non-empty/);
  });
  it('handles a single bar', () => {
    const r = summarizeBars([{ time: 1, open: 100, high: 101, low: 99, close: 100, volume: 10 }]);
    assert.equal(r.bar_count, 1);
    assert.equal(r.change, 0);
    assert.equal(r.high, 101);
    assert.equal(r.low, 99);
    assert.equal(r.last_5_bars.length, 1);
  });
});

// ── filterIndicatorInputs ───────────────────────────────────────────────

describe('filterIndicatorInputs()', () => {
  it('passes through short inputs unchanged', () => {
    const inputs = [{ id: 'length', value: 20 }, { id: 'text', value: 'label' }];
    assert.deepEqual(filterIndicatorInputs(inputs), inputs);
  });
  it('drops id=text with value > 200 chars', () => {
    const big = 'x'.repeat(201);
    const out = filterIndicatorInputs([{ id: 'text', value: big }, { id: 'length', value: 20 }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'length');
  });
  it('keeps id=text with value <= 200 chars', () => {
    const ok = 'y'.repeat(200);
    const out = filterIndicatorInputs([{ id: 'text', value: ok }]);
    assert.equal(out.length, 1);
  });
  it('drops any string input > 500 chars regardless of id', () => {
    const blob = 'b'.repeat(501);
    const out = filterIndicatorInputs([{ id: 'encoded', value: blob }, { id: 'length', value: 20 }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'length');
  });
  it('returns non-array inputs unchanged', () => {
    assert.equal(filterIndicatorInputs(undefined), undefined);
    assert.equal(filterIndicatorInputs(null), null);
  });
});

// ── processPineLines ────────────────────────────────────────────────────

describe('processPineLines()', () => {
  it('returns empty result when raw is empty', () => {
    assert.deepEqual(processPineLines([]), { success: true, study_count: 0, studies: [] });
    assert.deepEqual(processPineLines(null), { success: true, study_count: 0, studies: [] });
  });

  it('extracts horizontal price levels (y1 == y2)', () => {
    const raw = [{
      name: 'MyStudy', count: 3, items: [
        { id: 'a', raw: { y1: 100, y2: 100, x1: 1, x2: 2 } },
        { id: 'b', raw: { y1: 200, y2: 200, x1: 1, x2: 2 } },
        { id: 'c', raw: { y1: 50,  y2: 150, x1: 1, x2: 2 } }, // trend line, not horizontal
      ],
    }];
    const r = processPineLines(raw);
    assert.equal(r.study_count, 1);
    assert.deepEqual(r.studies[0].horizontal_levels, [200, 100]);
  });

  it('deduplicates identical horizontal levels', () => {
    const raw = [{
      name: 'S', count: 3, items: [
        { id: 'a', raw: { y1: 100, y2: 100 } },
        { id: 'b', raw: { y1: 100, y2: 100 } },
        { id: 'c', raw: { y1: 100.003, y2: 100.003 } }, // rounds to 100
      ],
    }];
    const r = processPineLines(raw);
    assert.deepEqual(r.studies[0].horizontal_levels, [100]);
  });

  it('sorts levels high → low', () => {
    const raw = [{
      name: 'S', count: 3, items: [
        { id: 'a', raw: { y1: 50, y2: 50 } },
        { id: 'b', raw: { y1: 200, y2: 200 } },
        { id: 'c', raw: { y1: 100, y2: 100 } },
      ],
    }];
    const r = processPineLines(raw);
    assert.deepEqual(r.studies[0].horizontal_levels, [200, 100, 50]);
  });

  it('rounds prices to 2dp', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: 'a', raw: { y1: 123.4567, y2: 123.4567 } }] }];
    const r = processPineLines(raw);
    assert.deepEqual(r.studies[0].horizontal_levels, [123.46]);
  });

  it('emits all_lines only in verbose mode', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: 'x', raw: { y1: 100, y2: 100, x1: 1, x2: 2, st: 0, w: 1, ci: '#f00' } }] }];
    const normal = processPineLines(raw, false);
    assert.ok(!('all_lines' in normal.studies[0]));
    const verbose = processPineLines(raw, true);
    assert.equal(verbose.studies[0].all_lines.length, 1);
    assert.equal(verbose.studies[0].all_lines[0].id, 'x');
    assert.equal(verbose.studies[0].all_lines[0].horizontal, true);
  });

  it('sets total_lines from input count', () => {
    const raw = [{ name: 'S', count: 42, items: [] }];
    const r = processPineLines(raw);
    assert.equal(r.studies[0].total_lines, 42);
  });
});

// ── processPineLabels ───────────────────────────────────────────────────

describe('processPineLabels()', () => {
  it('returns empty on empty input', () => {
    assert.deepEqual(processPineLabels([]), { success: true, study_count: 0, studies: [] });
  });

  it('maps label {t, y} into {text, price}', () => {
    const raw = [{ name: 'S', count: 2, items: [
      { id: '1', raw: { t: 'PDH', y: 24550 } },
      { id: '2', raw: { t: 'PDL', y: 24300.123 } },
    ]}];
    const r = processPineLabels(raw);
    assert.deepEqual(r.studies[0].labels, [
      { text: 'PDH', price: 24550 },
      { text: 'PDL', price: 24300.12 },
    ]);
  });

  it('drops labels with no text and no price', () => {
    const raw = [{ name: 'S', count: 2, items: [
      { id: '1', raw: { t: 'Keep', y: 100 } },
      { id: '2', raw: { t: '', y: null } },
    ]}];
    const r = processPineLabels(raw);
    assert.equal(r.studies[0].labels.length, 1);
    assert.equal(r.studies[0].labels[0].text, 'Keep');
  });

  it('keeps label when only text present', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: '1', raw: { t: 'NoPrice', y: null } }] }];
    const r = processPineLabels(raw);
    assert.equal(r.studies[0].labels[0].text, 'NoPrice');
    assert.equal(r.studies[0].labels[0].price, null);
  });

  it('defaults cap to DEFAULT_LABEL_LIMIT (50) and slices trailing', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ id: `${i}`, raw: { t: `L${i}`, y: i } }));
    const raw = [{ name: 'S', count: 60, items }];
    const r = processPineLabels(raw);
    assert.equal(r.studies[0].showing, DEFAULT_LABEL_LIMIT);
    assert.equal(r.studies[0].labels.length, 50);
    // We keep the trailing slice → first kept label is L10
    assert.equal(r.studies[0].labels[0].text, 'L10');
    assert.equal(r.studies[0].labels[49].text, 'L59');
  });

  it('honors custom max_labels parameter', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, raw: { t: `L${i}`, y: i } }));
    const r = processPineLabels([{ name: 'S', count: 10, items }], 3);
    assert.equal(r.studies[0].showing, 3);
    assert.equal(r.studies[0].labels.length, 3);
    assert.equal(r.studies[0].labels[0].text, 'L7');
  });

  it('emits verbose fields when requested', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: 'x', raw: { t: 'hi', y: 1, x: 10, yl: 'above', sz: 'normal', tci: '#000', ci: '#fff' } }] }];
    const r = processPineLabels(raw, 50, true);
    assert.equal(r.studies[0].labels[0].id, 'x');
    assert.equal(r.studies[0].labels[0].yloc, 'above');
  });
});

// ── processPineTables ───────────────────────────────────────────────────

describe('processPineTables()', () => {
  it('returns empty on empty input', () => {
    assert.deepEqual(processPineTables([]), { success: true, study_count: 0, studies: [] });
  });

  it('groups cells by table id and sorts rows/columns', () => {
    const raw = [{ name: 'S', count: 4, items: [
      { id: '1', raw: { tid: 1, row: 1, col: 0, t: 'b1' } },
      { id: '2', raw: { tid: 1, row: 0, col: 0, t: 'a1' } },
      { id: '3', raw: { tid: 1, row: 0, col: 1, t: 'a2' } },
      { id: '4', raw: { tid: 1, row: 1, col: 1, t: 'b2' } },
    ]}];
    const r = processPineTables(raw);
    assert.equal(r.studies[0].tables.length, 1);
    assert.deepEqual(r.studies[0].tables[0].rows, ['a1 | a2', 'b1 | b2']);
  });

  it('separates multiple tables by tid', () => {
    const raw = [{ name: 'S', count: 2, items: [
      { id: '1', raw: { tid: 0, row: 0, col: 0, t: 'T0' } },
      { id: '2', raw: { tid: 7, row: 0, col: 0, t: 'T7' } },
    ]}];
    const r = processPineTables(raw);
    assert.equal(r.studies[0].tables.length, 2);
  });

  it('defaults tid to 0 when absent', () => {
    const raw = [{ name: 'S', count: 1, items: [
      { id: '1', raw: { row: 0, col: 0, t: 'X' } },
    ]}];
    const r = processPineTables(raw);
    assert.equal(r.studies[0].tables.length, 1);
    assert.deepEqual(r.studies[0].tables[0].rows, ['X']);
  });

  it('filters empty cells out of joined rows', () => {
    const raw = [{ name: 'S', count: 3, items: [
      { id: '1', raw: { tid: 0, row: 0, col: 0, t: 'A' } },
      { id: '2', raw: { tid: 0, row: 0, col: 1, t: '' } },
      { id: '3', raw: { tid: 0, row: 0, col: 2, t: 'C' } },
    ]}];
    const r = processPineTables(raw);
    assert.deepEqual(r.studies[0].tables[0].rows, ['A | C']);
  });
});

// ── processPineBoxes ────────────────────────────────────────────────────

describe('processPineBoxes()', () => {
  it('returns empty on empty input', () => {
    assert.deepEqual(processPineBoxes([]), { success: true, study_count: 0, studies: [] });
  });

  it('computes high/low from y1/y2 regardless of order', () => {
    const raw = [{ name: 'S', count: 2, items: [
      { id: 'a', raw: { y1: 100, y2: 110 } }, // high=110, low=100
      { id: 'b', raw: { y1: 60, y2: 50 } },   // high=60,  low=50
    ]}];
    const r = processPineBoxes(raw);
    assert.deepEqual(r.studies[0].zones, [
      { high: 110, low: 100 },
      { high: 60, low: 50 },
    ]);
  });

  it('deduplicates identical zones by (high,low) key', () => {
    const raw = [{ name: 'S', count: 3, items: [
      { id: 'a', raw: { y1: 100, y2: 110 } },
      { id: 'b', raw: { y1: 110, y2: 100 } }, // same zone reversed
      { id: 'c', raw: { y1: 200, y2: 210 } },
    ]}];
    const r = processPineBoxes(raw);
    assert.equal(r.studies[0].zones.length, 2);
  });

  it('sorts zones by high descending', () => {
    const raw = [{ name: 'S', count: 3, items: [
      { id: 'a', raw: { y1: 50, y2: 60 } },
      { id: 'b', raw: { y1: 200, y2: 210 } },
      { id: 'c', raw: { y1: 100, y2: 110 } },
    ]}];
    const r = processPineBoxes(raw);
    assert.deepEqual(r.studies[0].zones.map(z => z.high), [210, 110, 60]);
  });

  it('skips zones with missing y1 or y2', () => {
    const raw = [{ name: 'S', count: 2, items: [
      { id: 'a', raw: { y1: 100, y2: null } },
      { id: 'b', raw: { y1: null, y2: null } },
    ]}];
    const r = processPineBoxes(raw);
    assert.equal(r.studies[0].zones.length, 0);
  });

  it('emits all_boxes with ids when verbose', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: 'bx1', raw: { y1: 100, y2: 110, x1: 1, x2: 2, c: '#f', bc: '#0' } }] }];
    const r = processPineBoxes(raw, true);
    assert.equal(r.studies[0].all_boxes.length, 1);
    assert.equal(r.studies[0].all_boxes[0].id, 'bx1');
  });

  it('rounds prices to 2dp', () => {
    const raw = [{ name: 'S', count: 1, items: [{ id: 'a', raw: { y1: 100.333, y2: 110.666 } }] }];
    const r = processPineBoxes(raw);
    assert.deepEqual(r.studies[0].zones, [{ high: 110.67, low: 100.33 }]);
  });
});
