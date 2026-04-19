/**
 * Unit tests for the error taxonomy in src/errors.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TvMcpError, ConnectionError, ConnectionLostError, AuthError,
  RateLimitError, UserInputError, UiStateError, TimeoutError,
  classifyError,
} from '../src/errors.js';

describe('TvMcpError base class', () => {
  it('exposes code, retryable, hint', () => {
    const e = new TvMcpError('x', { code: 'A', retryable: true, hint: 'do Y' });
    assert.equal(e.code, 'A');
    assert.equal(e.retryable, true);
    assert.equal(e.hint, 'do Y');
    assert.equal(e.message, 'x');
  });

  it('toJSON shape is stable and MCP-friendly', () => {
    const e = new TvMcpError('broken', { code: 'FOO', retryable: false, hint: 'h' });
    assert.deepEqual(e.toJSON(), {
      success: false, error: 'broken', error_code: 'FOO', retryable: false, hint: 'h',
    });
  });

  it('preserves cause when provided', () => {
    const inner = new Error('inner');
    const e = new TvMcpError('wrap', { cause: inner });
    assert.equal(e.cause, inner);
  });
});

describe('Concrete subclasses', () => {
  it('ConnectionError is retryable with launch hint', () => {
    const e = new ConnectionError('x');
    assert.equal(e.code, 'CONNECTION_ERROR');
    assert.equal(e.retryable, true);
    assert.match(e.hint, /TradingView/);
  });

  it('ConnectionLostError defaults message', () => {
    const e = new ConnectionLostError();
    assert.equal(e.code, 'CONNECTION_LOST');
    assert.equal(e.retryable, true);
  });

  it('AuthError is not retryable', () => {
    const e = new AuthError('403');
    assert.equal(e.retryable, false);
    assert.equal(e.code, 'AUTH_ERROR');
  });

  it('RateLimitError is retryable', () => {
    assert.equal(new RateLimitError().retryable, true);
  });

  it('UserInputError is terminal', () => {
    const e = new UserInputError('bad');
    assert.equal(e.retryable, false);
    assert.equal(e.code, 'INVALID_INPUT');
  });

  it('UiStateError and TimeoutError carry their codes', () => {
    assert.equal(new UiStateError('x').code, 'UI_STATE');
    assert.equal(new TimeoutError('x').code, 'TIMEOUT');
  });
});

describe('classifyError()', () => {
  it('ECONNREFUSED → ConnectionError', () => {
    const e = classifyError(new Error('connect ECONNREFUSED 127.0.0.1:9222'));
    assert.ok(e instanceof ConnectionError);
  });

  it('"not running" → ConnectionError', () => {
    const e = classifyError(new Error('TradingView is not running'));
    assert.ok(e instanceof ConnectionError);
  });

  it('401 → AuthError', () => {
    const e = classifyError(new Error('API returned 401 Unauthorized'));
    assert.ok(e instanceof AuthError);
  });

  it('403 → AuthError', () => {
    const e = classifyError(new Error('403 Forbidden'));
    assert.ok(e instanceof AuthError);
  });

  it('429 → RateLimitError', () => {
    const e = classifyError(new Error('429 Too Many Requests'));
    assert.ok(e instanceof RateLimitError);
  });

  it('"timeout" → TimeoutError', () => {
    const e = classifyError(new Error('request timeout'));
    assert.ok(e instanceof TimeoutError);
  });

  it('"socket closed" → ConnectionLostError', () => {
    const e = classifyError(new Error('WebSocket is not open: socket closed'));
    assert.ok(e instanceof ConnectionLostError);
  });

  it('unknown message → generic TvMcpError', () => {
    const e = classifyError(new Error('something weird'));
    assert.ok(e instanceof TvMcpError);
    assert.equal(e.code, 'UNKNOWN');
  });

  it('already-classified errors pass through unchanged', () => {
    const inner = new UserInputError('bad');
    assert.equal(classifyError(inner), inner);
  });

  it('non-Error inputs are coerced', () => {
    const e = classifyError('a string');
    assert.equal(e.message, 'a string');
  });
});
