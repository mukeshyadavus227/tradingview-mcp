/**
 * Shared JSDoc type definitions for the public API surface of
 * tradingview-mcp. Import these typedefs in other files with:
 *
 *    /** @typedef {import('./types.js').OhlcvBar} OhlcvBar *\/
 *
 * These are JSDoc-only — there is no runtime cost. IDEs and `tsc
 * --checkJs` will pick them up.
 */

/**
 * @typedef {Object} OhlcvBar
 * @property {number} time    — unix seconds
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} OhlcvSummary
 * @property {true} success
 * @property {number} bar_count
 * @property {{from:number, to:number}} period
 * @property {number} open
 * @property {number} close
 * @property {number} high
 * @property {number} low
 * @property {number} range
 * @property {number} change
 * @property {string} change_pct
 * @property {number} avg_volume
 * @property {OhlcvBar[]} last_5_bars
 */

/**
 * @typedef {Object} PriceLevel
 * @property {string} name
 * @property {number} total_lines
 * @property {number[]} horizontal_levels
 */

/**
 * @typedef {Object} PriceZone
 * @property {number} high
 * @property {number} low
 */

/**
 * @typedef {Object} ChartState
 * @property {true} success
 * @property {string} symbol
 * @property {string} resolution
 * @property {number} chartType
 * @property {Array<{id:string, name:string}>} studies
 */

/**
 * @typedef {Object} PineDiagnostic
 * @property {number} line
 * @property {number} column
 * @property {'error'|'warning'|'info'} severity
 * @property {string} message
 */

/**
 * @typedef {Object} PineAnalyzeResult
 * @property {true} success
 * @property {number} issue_count
 * @property {PineDiagnostic[]} diagnostics
 * @property {string} [note]
 */

/**
 * @typedef {Object} PineCompileResult
 * @property {true} success
 * @property {boolean} compiled
 * @property {number} error_count
 * @property {number} warning_count
 * @property {PineDiagnostic[]} [errors]
 * @property {PineDiagnostic[]} [warnings]
 * @property {string} [note]
 */

/**
 * @typedef {Object} QuoteSnapshot
 * @property {true} success
 * @property {string} symbol
 * @property {number} [time]
 * @property {number} [open]
 * @property {number} [high]
 * @property {number} [low]
 * @property {number} [close]
 * @property {number} [volume]
 * @property {number} [bid]
 * @property {number} [ask]
 */

/**
 * @typedef {Object} ErrorEnvelope
 * @property {false} success
 * @property {string} error
 * @property {string} error_code
 * @property {boolean} retryable
 * @property {string|null} hint
 */

/**
 * @typedef {Object} ProgressReporter
 * @property {(pct:number, message?:string) => void} [update]
 * @property {(msg:string) => void} [log]
 */

export {}; // marker to make this a module
