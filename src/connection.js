import CDP from 'chrome-remote-interface';
import { ConnectionError, ConnectionLostError, classifyError } from './errors.js';
import { onShutdown } from './shutdown.js';

onShutdown('cdp-client', async () => {
  if (client) {
    try { await client.close(); } catch { /* ignore */ }
    client = null;
    targetInfo = null;
  }
});

let client = null;
let targetInfo = null;
const CDP_HOST = 'localhost';
const CDP_PORT = 9222;
export const MAX_RETRIES = 5;
export const BASE_DELAY = 500;
const BACKOFF_CAP = 30000;

// ── Test-mode overrides ─────────────────────────────────────────────────
// Unit tests install mocks here so core/* modules (which import evaluate,
// getClient, getChartApi etc. at module load time) don't need a live CDP.
// Production code never touches this — overrides default to null.
let _testOverrides = null;

/** Install test mocks. Pass null to reset. */
export function __setTestOverrides(mocks) {
  _testOverrides = mocks;
}
export function __getTestOverrides() { return _testOverrides; }

/**
 * Compute the backoff delay (ms) for an attempt using exponential strategy
 * capped at BACKOFF_CAP. Attempt 0 → BASE_DELAY, attempt N → BASE_DELAY*2^N.
 */
export function computeBackoff(attempt, base = BASE_DELAY, cap = BACKOFF_CAP) {
  return Math.min(base * Math.pow(2, attempt), cap);
}

/**
 * Retry an async operation with exponential backoff, up to `maxRetries` times.
 * `sleep` and `maxRetries` are injectable so this can be unit tested without
 * real timers.
 * Rejects with the last error, prefixed with `label`.
 */
export async function retryWithBackoff(op, { label = 'operation', maxRetries = MAX_RETRIES, sleep = (ms) => new Promise(r => setTimeout(r, ms)), base = BASE_DELAY, cap = BACKOFF_CAP } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await op(attempt);
    } catch (err) {
      lastError = err;
      await sleep(computeBackoff(attempt, base, cap));
    }
  }
  throw new Error(`${label} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// Known direct API paths discovered via live probing (see PROBE_RESULTS.md)
const KNOWN_PATHS = {
  chartApi: 'window.TradingViewApi._activeChartWidgetWV.value()',
  chartWidgetCollection: 'window.TradingViewApi._chartWidgetCollection',
  bottomWidgetBar: 'window.TradingView.bottomWidgetBar',
  replayApi: 'window.TradingViewApi._replayApi',
  alertService: 'window.TradingViewApi._alertService',
  chartApiInstance: 'window.ChartApiInstance',
  mainSeriesBars: 'window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars()',
  // Phase 1: Strategy data — model().dataSources() → find strategy → .performance().value(), .ordersData(), .reportData()
  strategyStudy: 'chart._chartWidget.model().model().dataSources()',
  // Phase 2: Layouts — getSavedCharts(cb), loadChartFromServer(id)
  layoutManager: 'window.TradingViewApi.getSavedCharts',
  // Phase 5: Symbol search — searchSymbols(query) returns Promise
  symbolSearchApi: 'window.TradingViewApi.searchSymbols',
  // Phase 6: Pine scripts — REST API at pine-facade.tradingview.com/pine-facade/list/?filter=saved
  pineFacadeApi: 'https://pine-facade.tradingview.com/pine-facade',
};

export { KNOWN_PATHS };

/**
 * Sanitize a string for safe interpolation into JavaScript code evaluated via CDP.
 * Uses JSON.stringify to produce a properly escaped JS string literal (with quotes).
 * Prevents injection via quotes, backticks, template literals, or control chars.
 */
export function safeString(str) {
  return JSON.stringify(String(str));
}

/**
 * Validate that a value is a finite number. Throws if NaN, Infinity, or non-numeric.
 * Prevents corrupt values from reaching TradingView APIs that persist to cloud state.
 */
export function requireFinite(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number, got: ${value}`);
  return n;
}

export async function getClient() {
  if (_testOverrides?.getClient) return _testOverrides.getClient();
  if (client) {
    try {
      // Quick liveness check
      await client.Runtime.evaluate({ expression: '1', returnByValue: true });
      return client;
    } catch {
      client = null;
      targetInfo = null;
    }
  }
  return connect();
}

export async function connect() {
  return retryWithBackoff(async () => {
    const target = await findChartTarget();
    if (!target) {
      throw new Error('No TradingView chart target found. Is TradingView open with a chart?');
    }
    targetInfo = target;
    client = await CDP({ host: CDP_HOST, port: CDP_PORT, target: target.id });
    await client.Runtime.enable();
    await client.Page.enable();
    await client.DOM.enable();
    return client;
  }, { label: 'CDP connection' });
}

async function findChartTarget() {
  const resp = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`);
  const targets = await resp.json();
  // Prefer targets with tradingview.com/chart in the URL
  return targets.find(t => t.type === 'page' && /tradingview\.com\/chart/i.test(t.url))
    || targets.find(t => t.type === 'page' && /tradingview/i.test(t.url))
    || null;
}

export async function getTargetInfo() {
  if (_testOverrides?.getTargetInfo) return _testOverrides.getTargetInfo();
  if (!targetInfo) {
    await getClient();
  }
  return targetInfo;
}

/** Detect a disconnection-type error from chrome-remote-interface. */
function isDisconnectError(err) {
  const msg = err?.message || '';
  return /WebSocket is not open|socket hang up|ECONNRESET|connection closed|ws closed|ECONNREFUSED/i.test(msg);
}

export async function evaluate(expression, opts = {}) {
  if (_testOverrides?.evaluate) return _testOverrides.evaluate(expression, opts);
  // First attempt. If the socket died underneath us, drop the client cache
  // and retry exactly once before bubbling the error up. This makes the
  // CLI and MCP tools self-healing across a TradingView restart.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await getClient();
      const result = await c.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: opts.awaitPromise ?? false,
        ...opts,
      });
      if (result.exceptionDetails) {
        const msg = result.exceptionDetails.exception?.description
          || result.exceptionDetails.text
          || 'Unknown evaluation error';
        throw new Error(`JS evaluation error: ${msg}`);
      }
      return result.result?.value;
    } catch (err) {
      if (attempt === 0 && isDisconnectError(err)) {
        client = null;
        targetInfo = null;
        continue;
      }
      throw attempt === 0 ? err : new ConnectionLostError(err.message, { cause: err });
    }
  }
}

export async function evaluateAsync(expression) {
  if (_testOverrides?.evaluateAsync) return _testOverrides.evaluateAsync(expression);
  return evaluate(expression, { awaitPromise: true });
}

export async function disconnect() {
  if (client) {
    try { await client.close(); } catch {}
    client = null;
    targetInfo = null;
  }
}

// --- Direct API path helpers ---
// Each returns the STRING expression path after verifying it exists.
// Callers use the returned string in their own evaluate() calls.

async function verifyAndReturn(path, name) {
  const exists = await evaluate(`typeof (${path}) !== 'undefined' && (${path}) !== null`);
  if (!exists) {
    throw new Error(`${name} not available at ${path}`);
  }
  return path;
}

export async function getChartApi() {
  if (_testOverrides?.getChartApi) return _testOverrides.getChartApi();
  return verifyAndReturn(KNOWN_PATHS.chartApi, 'Chart API');
}

export async function getChartCollection() {
  if (_testOverrides?.getChartCollection) return _testOverrides.getChartCollection();
  return verifyAndReturn(KNOWN_PATHS.chartWidgetCollection, 'Chart Widget Collection');
}

export async function getBottomBar() {
  if (_testOverrides?.getBottomBar) return _testOverrides.getBottomBar();
  return verifyAndReturn(KNOWN_PATHS.bottomWidgetBar, 'Bottom Widget Bar');
}

export async function getReplayApi() {
  if (_testOverrides?.getReplayApi) return _testOverrides.getReplayApi();
  return verifyAndReturn(KNOWN_PATHS.replayApi, 'Replay API');
}

export async function getMainSeriesBars() {
  if (_testOverrides?.getMainSeriesBars) return _testOverrides.getMainSeriesBars();
  return verifyAndReturn(KNOWN_PATHS.mainSeriesBars, 'Main Series Bars');
}
