/**
 * Progress-reporting utilities for long-running operations.
 *
 * Core functions that take minutes (batch runs, autoplay replays,
 * captureScreenshot with heavy pages) accept an optional `progress`
 * callback. Both the MCP transport and the CLI layer can plug in a
 * reporter — MCP via progress notifications, CLI via stderr updates.
 */

/**
 * @typedef {Object} ProgressReporter
 * @property {(pct:number, message?:string) => void} [update]  — 0..1 progress
 * @property {(msg:string) => void} [log]                       — free-form log line
 */

/** No-op reporter — safe default when the caller doesn't care. */
export const nullReporter = Object.freeze({
  update: () => {},
  log: () => {},
});

/** Write progress updates to stderr as single-line status messages. */
export function stderrReporter(label = 'progress') {
  return {
    update(pct, message) {
      const bar = '█'.repeat(Math.max(0, Math.min(20, Math.round(pct * 20)))).padEnd(20, '░');
      const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
      const line = `[${label}] ${bar} ${pctStr}${message ? ' ' + message : ''}\n`;
      process.stderr.write(line);
    },
    log(msg) {
      process.stderr.write(`[${label}] ${msg}\n`);
    },
  };
}

/**
 * Build a reporter that buffers the last N update events — useful for
 * tests and for reporting a summary after a failure.
 */
export function memoryReporter() {
  const events = [];
  return {
    events,
    update(pct, message) { events.push({ type: 'update', pct, message }); },
    log(msg) { events.push({ type: 'log', msg }); },
  };
}

/** Coerce an optional reporter-like object into a full ProgressReporter. */
export function ensureReporter(r) {
  if (!r) return nullReporter;
  return {
    update: typeof r.update === 'function' ? r.update.bind(r) : nullReporter.update,
    log: typeof r.log === 'function' ? r.log.bind(r) : nullReporter.log,
  };
}
