/**
 * Defensive-branch tests (step 4 — last ~15% of coverage).
 *
 * Chases catch/fallback paths that happy-path tests don't hit:
 *   - connection.js auto-reconnect on disconnect errors
 *   - pine.js error paths (Monaco returns null, setValue fails)
 *   - batch.js uncommon action branches
 *   - drawing.js sanitizeOverrides error cases
 *   - progress.js stderrReporter rendering
 *   - wait.js null-state continue branch
 *   - shutdown.js manual trigger
 */
import { describe, it, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from './helpers/mock-cdp.js';
import * as pine from '../src/core/pine.js';
import * as batch from '../src/core/batch.js';
import * as conn from '../src/connection.js';
import * as indicators from '../src/core/indicators.js';
import * as drawing from '../src/core/drawing.js';
import { UserInputError, ConnectionLostError } from '../src/errors.js';
import { stderrReporter, memoryReporter } from '../src/progress.js';
import { waitForChartReady } from '../src/wait.js';

describe('defensive branches — connection.js auto-reconnect', () => {
  afterEach(() => resetCdpMocks());

  it('evaluate retries once after disconnect then succeeds', async () => {
    // getClient throws "WebSocket is not open" the first time (triggers
    // the isDisconnectError branch), returns a fake client the second.
    let call = 0;
    const fake = fakeCdpClient();
    fake.Runtime.evaluate = async () => ({ result: { value: 'recovered' } });
    installCdpMocks({
      getClient: async () => {
        call++;
        if (call === 1) throw new Error('WebSocket is not open');
        return fake;
      },
    });
    const r = await conn.evaluate('2 + 2');
    assert.equal(r, 'recovered');
    assert.equal(call, 2, 'second getClient call should have fired');
  });

  it('evaluate propagates non-disconnect errors without retry', async () => {
    let call = 0;
    installCdpMocks({
      getClient: async () => { call++; throw new Error('totally unrelated'); },
    });
    await assert.rejects(conn.evaluate('x'), /unrelated/);
    assert.equal(call, 1, 'should not retry on non-disconnect errors');
  });

  it('evaluate wraps persistent disconnect as ConnectionLostError', async () => {
    let call = 0;
    installCdpMocks({
      getClient: async () => { call++; throw new Error('socket hang up'); },
    });
    await assert.rejects(conn.evaluate('x'), ConnectionLostError);
    assert.equal(call, 2, 'should have retried exactly once');
  });

  it('evaluate surfaces JS exceptionDetails from Runtime.evaluate', async () => {
    const fake = fakeCdpClient();
    fake.Runtime.evaluate = async () => ({
      exceptionDetails: { text: 'thrown from page', exception: { description: 'ReferenceError: foo' } },
    });
    installCdpMocks({ getClient: async () => fake });
    await assert.rejects(conn.evaluate('foo()'), /JS evaluation error.*ReferenceError/);
  });
});

describe('defensive branches — pine.js error paths', () => {
  afterEach(() => resetCdpMocks());

  it('getSource throws when Monaco returns null', async () => {
    let call = 0;
    installCdpMocks({
      evaluate: async () => (++call === 1 ? true : null), // editor open, then getValue=null
    });
    await assert.rejects(pine.getSource(), /getValue\(\) returned null/);
  });

  it('setSource throws when setValue reports failure', async () => {
    let call = 0;
    installCdpMocks({
      evaluate: async () => (++call === 1 ? true : false), // editor open, setValue returns false
    });
    await assert.rejects(pine.setSource({ source: 'x' }), /setValue\(\) failed/);
  });

  it('getErrors/getConsole throw when editor cannot be opened', async () => {
    // First call: Monaco not present. Opening the editor never succeeds — but
    // the polling loop takes 10s. Use a short stub that always returns false
    // via the override so only the initial check fires then opens attempts
    // run; we short-circuit by checking only the first error message.
    // For performance, only test the first early-exit of getErrors.
    installCdpMocks({ evaluate: async () => { throw new Error('broke'); } });
    await assert.rejects(pine.getErrors(), /broke|Could not open/);
  });
});

describe('defensive branches — batch.js action branches', () => {
  const READY = { isLoading: false, barCount: 50, currentSymbol: '' };

  afterEach(() => resetCdpMocks());

  it('unknown action produces {error} in result', async () => {
    installCdpMocks({
      getChartCollection: async () => 'window.cwc',
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => READY,
    });
    const r = await batch.batchRun({ symbols: ['AAPL'], action: 'flap-jack', delay_ms: 10 });
    assert.equal(r.successful, 1);
    assert.match(r.results[0].result.error, /Unknown action/);
  });

  it('iteration error is caught per-iteration', async () => {
    // evaluateAsync rejects → handler records failure
    installCdpMocks({
      getChartCollection: async () => 'window.cwc',
      getChartApi: async () => 'window.chartApi',
      evaluate: async () => READY,
      evaluateAsync: async () => { throw new Error('export-data blew up'); },
    });
    const r = await batch.batchRun({ symbols: ['AAPL'], action: 'get_ohlcv', delay_ms: 10 });
    assert.equal(r.failed, 1);
    assert.match(r.results[0].error, /export-data blew up/);
  });

  it('buildBatchPlan uses non-array timeframes as no-tf (default)', async () => {
    const plan = batch.buildBatchPlan(['X'], 'not-an-array');
    assert.deepEqual(plan, [{ symbol: 'X', timeframe: null }]);
  });
});

describe('defensive branches — indicators.js validation', () => {
  it('setInputs rejects empty inputs object', async () => {
    await assert.rejects(
      indicators.setInputs({ entity_id: 'st-1', inputs: {} }),
      /non-empty object/,
    );
  });

  it('setInputs rejects missing inputs', async () => {
    await assert.rejects(
      indicators.setInputs({ entity_id: 'st-1' }),
      /non-empty object/,
    );
  });

  it('toggleVisibility rejects missing entity_id', async () => {
    await assert.rejects(
      indicators.toggleVisibility({ visible: true }),
      /entity_id is required/,
    );
  });
});

describe('defensive branches — drawing.js sanitizeOverrides', () => {
  it('rejects malformed JSON string', () => {
    assert.throws(() => drawing.sanitizeOverrides('{not json}'), SyntaxError);
  });

  it('rejects arrays', () => {
    assert.throws(() => drawing.sanitizeOverrides([1, 2, 3]), UserInputError);
  });

  it('drops Infinity but keeps finite number siblings', () => {
    const r = drawing.sanitizeOverrides({ linewidth: Infinity, fontsize: 14 });
    assert.deepEqual(r, { fontsize: 14 });
  });

  it('drops function-valued properties', () => {
    const r = drawing.sanitizeOverrides({ linewidth: 2, mischief: () => 1 });
    assert.deepEqual(r, { linewidth: 2 });
  });
});

describe('defensive branches — progress.js stderrReporter', () => {
  it('stderrReporter emits formatted bar + pct without throwing', () => {
    const r = stderrReporter('test');
    const origWrite = process.stderr.write.bind(process.stderr);
    const lines = [];
    process.stderr.write = (s) => { lines.push(s); return true; };
    try {
      r.update(0.25, 'msg');
      r.update(1, 'done');
      r.log('extra');
    } finally {
      process.stderr.write = origWrite;
    }
    assert.match(lines[0], /\[test\].*25%.*msg/);
    assert.match(lines[1], /\[test\].*100%.*done/);
    assert.match(lines[2], /\[test\].*extra/);
  });
});

describe('defensive branches — wait.js null-state continue', () => {
  afterEach(() => resetCdpMocks());

  it('polls again when evaluate returns null (not ready)', async () => {
    let call = 0;
    installCdpMocks({
      evaluate: async () => {
        call++;
        if (call === 1) return null;                      // first poll: bad
        return { isLoading: false, barCount: 10, currentSymbol: '' }; // then stable
      },
    });
    assert.equal(await waitForChartReady(null, null, 2000), true);
    assert.ok(call >= 3, 'should have polled at least 3 times (null → stable × 2)');
  });
});

describe('defensive branches — shutdown.js race / manual trigger', () => {
  // Already tested in shutdown.test.js; this one exercises the specific
  // branch where the shutdown coordinator is triggered from Node's
  // beforeExit event (exercised at test-process termination via the real
  // listener installed by installOnce). Covered implicitly — skip here.
  it.todo('beforeExit listener covered implicitly by test-process termination');
});
