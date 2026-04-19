/**
 * Error taxonomy for tradingview-mcp.
 * Every error thrown by core/* should be one of these subclasses so callers
 * (MCP clients, CLI, test suite) can branch on error.code instead of regexing
 * err.message.
 *
 * Each error carries:
 *   - code   — machine-readable identifier (e.g. 'CONNECTION_LOST')
 *   - retryable — whether the caller should retry the same op
 *   - hint   — human-readable remediation suggestion
 */

export class TvMcpError extends Error {
  constructor(message, { code = 'UNKNOWN', retryable = false, hint = null, cause = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.hint = hint;
    if (cause) this.cause = cause;
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      error_code: this.code,
      retryable: this.retryable,
      hint: this.hint,
    };
  }
}

/** CDP not reachable at all (TradingView not running, wrong port). */
export class ConnectionError extends TvMcpError {
  constructor(message, opts = {}) {
    super(message, {
      code: 'CONNECTION_ERROR',
      retryable: true,
      hint: 'Is TradingView Desktop running with --remote-debugging-port=9222? Try tv_launch.',
      ...opts,
    });
  }
}

/** CDP client disconnected mid-session — should auto-reconnect. */
export class ConnectionLostError extends TvMcpError {
  constructor(message = 'CDP connection lost', opts = {}) {
    super(message, {
      code: 'CONNECTION_LOST',
      retryable: true,
      hint: 'The client will reconnect automatically on the next call.',
      ...opts,
    });
  }
}

/** Upstream API rejected the request (pine-facade 401/403). */
export class AuthError extends TvMcpError {
  constructor(message, opts = {}) {
    super(message, {
      code: 'AUTH_ERROR',
      retryable: false,
      hint: 'Sign in to TradingView in your desktop app, then retry.',
      ...opts,
    });
  }
}

/** Upstream API rate-limited us. */
export class RateLimitError extends TvMcpError {
  constructor(message = 'Rate limited by upstream API', opts = {}) {
    super(message, {
      code: 'RATE_LIMITED',
      retryable: true,
      hint: 'Wait a few seconds before retrying.',
      ...opts,
    });
  }
}

/** Caller passed invalid input that would corrupt state. */
export class UserInputError extends TvMcpError {
  constructor(message, opts = {}) {
    super(message, {
      code: 'INVALID_INPUT',
      retryable: false,
      hint: null,
      ...opts,
    });
  }
}

/** The chart/editor DOM element we need isn't there (wrong state). */
export class UiStateError extends TvMcpError {
  constructor(message, opts = {}) {
    super(message, {
      code: 'UI_STATE',
      retryable: false,
      hint: 'Open the relevant TradingView panel (Pine Editor, Watchlist, etc.) then retry.',
      ...opts,
    });
  }
}

/** Operation timed out waiting for a state change. */
export class TimeoutError extends TvMcpError {
  constructor(message, opts = {}) {
    super(message, {
      code: 'TIMEOUT',
      retryable: true,
      hint: null,
      ...opts,
    });
  }
}

/**
 * Wrap an unknown thrown value into a TvMcpError, classifying common
 * patterns (ECONNREFUSED, 401/403, timeout, etc.) heuristically.
 */
export function classifyError(err) {
  if (err instanceof TvMcpError) return err;
  const msg = err?.message || String(err);
  if (/ECONNREFUSED|connection refused|not running/i.test(msg)) {
    return new ConnectionError(msg, { cause: err });
  }
  if (/\b40[13]\b|unauthorized|forbidden/i.test(msg)) {
    return new AuthError(msg, { cause: err });
  }
  if (/\b429\b|rate limit/i.test(msg)) {
    return new RateLimitError(msg, { cause: err });
  }
  if (/timeout|timed out/i.test(msg)) {
    return new TimeoutError(msg, { cause: err });
  }
  if (/socket closed|connection closed|ws closed/i.test(msg)) {
    return new ConnectionLostError(msg, { cause: err });
  }
  return new TvMcpError(msg, { cause: err });
}
