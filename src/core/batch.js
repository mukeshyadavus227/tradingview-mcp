/**
 * Core batch execution logic.
 */
import { evaluate, evaluateAsync, getClient, getChartApi, getChartCollection, safeString } from '../connection.js';
import { waitForChartReady } from '../wait.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureReporter } from '../progress.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(dirname(dirname(__dirname)), 'screenshots');

/**
 * Enumerate the (symbol, timeframe) iteration plan for a batch run.
 * Returns an array of {symbol, timeframe} pairs. Pure.
 */
export function buildBatchPlan(symbols, timeframes) {
  if (!Array.isArray(symbols) || symbols.length === 0) return [];
  const tfs = Array.isArray(timeframes) && timeframes.length > 0 ? timeframes : [null];
  const plan = [];
  for (const symbol of symbols) {
    for (const timeframe of tfs) {
      plan.push({ symbol, timeframe });
    }
  }
  return plan;
}

/** Summarize batch results into success/failure counts. Pure. */
export function summarizeBatchResults(results) {
  const successful = results.filter(r => r.success).length;
  return {
    success: true,
    total_iterations: results.length,
    successful,
    failed: results.length - successful,
    results,
  };
}

/** Build a batch screenshot filename like "batch_AAPL_5_2025-01-15T...". Pure. */
export function buildBatchScreenshotName(symbol, timeframe, now = new Date()) {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const raw = `batch_${symbol}_${timeframe || 'default'}_${ts}`;
  return raw.replace(/[\/\\]/g, '_') + '.png';
}

export async function batchRun({ symbols, timeframes, action, delay_ms, ohlcv_count, progress }) {
  const plan = buildBatchPlan(symbols, timeframes);
  const delay = delay_ms || 2000;
  const results = [];
  const reporter = ensureReporter(progress);
  reporter.log(`batch starting: ${plan.length} iterations`);

  let colPath, apiPath;
  try { colPath = await getChartCollection(); } catch {}
  try { apiPath = await getChartApi(); } catch {}

  let step = 0;
  for (const { symbol, timeframe: tf } of plan) {
    {
      const combo = { symbol, timeframe: tf };
      reporter.update(step / plan.length, `${symbol}${tf ? ` @ ${tf}` : ''}`);
      step++;
      try {
        if (colPath) await evaluate(`${colPath}.setSymbol(${safeString(symbol)})`);
        else if (apiPath) await evaluate(`${apiPath}.setSymbol(${safeString(symbol)})`);

        if (tf) {
          if (colPath) await evaluate(`${colPath}.setResolution(${safeString(tf)})`);
          else if (apiPath) await evaluate(`${apiPath}.setResolution(${safeString(tf)})`);
        }

        await waitForChartReady(symbol);
        await new Promise(r => setTimeout(r, delay));

        let actionResult;
        if (action === 'screenshot') {
          mkdirSync(SCREENSHOT_DIR, { recursive: true });
          const client = await getClient();
          const { data } = await client.Page.captureScreenshot({ format: 'png' });
          const filePath = join(SCREENSHOT_DIR, buildBatchScreenshotName(symbol, tf));
          writeFileSync(filePath, Buffer.from(data, 'base64'));
          actionResult = { file_path: filePath };
        } else if (action === 'get_ohlcv' && apiPath) {
          const limit = Math.min(ohlcv_count || 100, 500);
          actionResult = await evaluateAsync(`
            new Promise(function(resolve, reject) {
              ${apiPath}.exportData({ includeTime: true, includeSeries: true, includeStudies: false })
                .then(function(result) {
                  var bars = (result.data || []).slice(-${limit});
                  resolve({ bar_count: bars.length, last_bar: bars[bars.length - 1] || null });
                }).catch(reject);
            })
          `);
        } else if (action === 'get_strategy_results') {
          await new Promise(r => setTimeout(r, 1000));
          actionResult = await evaluate(`
            (function() {
              var metrics = {};
              var panel = document.querySelector('[data-name="backtesting"]') || document.querySelector('[class*="strategyReport"]');
              if (!panel) return { error: 'Strategy Tester not found' };
              var items = panel.querySelectorAll('[class*="reportItem"], [class*="metric"]');
              items.forEach(function(item) {
                var label = item.querySelector('[class*="label"]');
                var value = item.querySelector('[class*="value"]');
                if (label && value) metrics[label.textContent.trim()] = value.textContent.trim();
              });
              return { metric_count: Object.keys(metrics).length, metrics: metrics };
            })()
          `);
        } else {
          actionResult = { error: 'Unknown action or API not available: ' + action };
        }
        results.push({ ...combo, success: true, result: actionResult });
      } catch (err) {
        results.push({ ...combo, success: false, error: err.message });
      }
    }
  }

  reporter.update(1, 'done');
  return summarizeBatchResults(results);
}
