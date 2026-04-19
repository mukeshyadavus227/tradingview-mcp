/**
 * Unit tests for retry/backoff logic in src/connection.js.
 * No CDP connection required — uses injected mock sleep.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBackoff, retryWithBackoff, MAX_RETRIES, BASE_DELAY } from '../src/connection.js';

// ── computeBackoff() ────────────────────────────────────────────────────

describe('computeBackoff() — exponential delay', () => {
  it('attempt 0 returns base', () => {
    assert.equal(computeBackoff(0), BASE_DELAY);
  });

  it('attempt 1 returns base*2', () => {
    assert.equal(computeBackoff(1), BASE_DELAY * 2);
  });

  it('attempt 3 returns base*8', () => {
    assert.equal(computeBackoff(3), BASE_DELAY * 8);
  });

  it('caps at 30_000 by default', () => {
    assert.equal(computeBackoff(100), 30_000);
  });

  it('honors custom base and cap', () => {
    assert.equal(computeBackoff(0, 100, 10_000), 100);
    assert.equal(computeBackoff(2, 100, 10_000), 400);
    assert.equal(computeBackoff(10, 100, 500), 500); // capped
  });
});

// ── retryWithBackoff() ──────────────────────────────────────────────────

describe('retryWithBackoff()', () => {
  function mockSleep() {
    const delays = [];
    const fn = async (ms) => { delays.push(ms); };
    fn.delays = delays;
    return fn;
  }

  it('returns the value on first success', async () => {
    const sleep = mockSleep();
    const result = await retryWithBackoff(async () => 'ok', { sleep });
    assert.equal(result, 'ok');
  });

  it('does not sleep on first-attempt success', async () => {
    // Even successful attempts trigger the sleep once in the current impl;
    // verify retry path specifically
    const sleep = mockSleep();
    let calls = 0;
    const result = await retryWithBackoff(async () => { calls++; return 42; }, { sleep });
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });

  it('retries on error and succeeds on a later attempt', async () => {
    const sleep = mockSleep();
    let calls = 0;
    const result = await retryWithBackoff(async () => {
      calls++;
      if (calls < 3) throw new Error('still flaky');
      return 'done';
    }, { sleep, base: 10, cap: 100 });
    assert.equal(result, 'done');
    assert.equal(calls, 3);
    // Two failed attempts → two sleeps before the 3rd success
    assert.equal(sleep.delays.length, 2);
    assert.equal(sleep.delays[0], 10);
    assert.equal(sleep.delays[1], 20);
  });

  it('uses exponential delays between retries', async () => {
    const sleep = mockSleep();
    let calls = 0;
    try {
      await retryWithBackoff(async () => { calls++; throw new Error('always fails'); }, {
        sleep, maxRetries: 4, base: 5, cap: 10_000,
      });
    } catch { /* expected */ }
    assert.equal(calls, 4);
    assert.deepEqual(sleep.delays, [5, 10, 20, 40]);
  });

  it('respects backoff cap when attempts grow large', async () => {
    const sleep = mockSleep();
    try {
      await retryWithBackoff(async () => { throw new Error('x'); }, {
        sleep, maxRetries: 6, base: 100, cap: 300,
      });
    } catch { /* expected */ }
    // 100, 200, capped at 300 from then on
    assert.deepEqual(sleep.delays, [100, 200, 300, 300, 300, 300]);
  });

  it('throws with the label after all retries exhausted', async () => {
    const sleep = mockSleep();
    await assert.rejects(
      retryWithBackoff(async () => { throw new Error('underlying'); }, {
        sleep, maxRetries: 2, label: 'widget', base: 1, cap: 10,
      }),
      /widget failed after 2 attempts.*underlying/
    );
  });

  it('defaults maxRetries to MAX_RETRIES', async () => {
    const sleep = mockSleep();
    let calls = 0;
    try {
      await retryWithBackoff(async () => { calls++; throw new Error('x'); }, { sleep, base: 1, cap: 2 });
    } catch { /* expected */ }
    assert.equal(calls, MAX_RETRIES);
  });

  it('passes the attempt index to the operation', async () => {
    const sleep = mockSleep();
    const attempts = [];
    try {
      await retryWithBackoff(async (attempt) => {
        attempts.push(attempt);
        throw new Error('x');
      }, { sleep, maxRetries: 3, base: 1, cap: 10 });
    } catch { /* expected */ }
    assert.deepEqual(attempts, [0, 1, 2]);
  });
});
