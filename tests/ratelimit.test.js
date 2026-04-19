/**
 * Unit tests for TokenBucket rate limiter.
 * Clock is injected so tests are fully deterministic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket, pineFacadeLimiter, priceAlertsLimiter } from '../src/ratelimit.js';

function mockClock(startAt = 0) {
  const state = { now: startAt };
  return {
    now: () => state.now,
    advance: (ms) => { state.now += ms; },
    set: (v) => { state.now = v; },
  };
}

describe('TokenBucket — construction', () => {
  it('rejects non-positive capacity', () => {
    assert.throws(() => new TokenBucket({ capacity: 0, refillPerSec: 1 }));
    assert.throws(() => new TokenBucket({ capacity: -1, refillPerSec: 1 }));
  });
  it('rejects non-positive refill', () => {
    assert.throws(() => new TokenBucket({ capacity: 5, refillPerSec: 0 }));
  });
});

describe('TokenBucket — tryAcquire()', () => {
  it('starts full', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 5, refillPerSec: 1, now: c.now });
    for (let i = 0; i < 5; i++) assert.equal(b.tryAcquire(), true);
    assert.equal(b.tryAcquire(), false);
  });

  it('refills over time', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 5, refillPerSec: 2, now: c.now });
    for (let i = 0; i < 5; i++) b.tryAcquire();
    assert.equal(b.tryAcquire(), false);
    c.advance(500); // 0.5s × 2/sec = 1 token
    assert.equal(b.tryAcquire(), true);
    assert.equal(b.tryAcquire(), false);
  });

  it('caps refill at capacity', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 3, refillPerSec: 10, now: c.now });
    b.tryAcquire(3);
    c.advance(10_000); // could refill 100, but cap=3
    for (let i = 0; i < 3; i++) assert.equal(b.tryAcquire(), true);
    assert.equal(b.tryAcquire(), false);
  });

  it('can acquire multiple tokens at once', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 5, refillPerSec: 1, now: c.now });
    assert.equal(b.tryAcquire(3), true);
    assert.equal(b.tryAcquire(3), false);
    assert.equal(b.tryAcquire(2), true);
  });
});

describe('TokenBucket — msUntilAvailable()', () => {
  it('returns 0 when tokens are available', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 5, refillPerSec: 1, now: c.now });
    assert.equal(b.msUntilAvailable(1), 0);
  });

  it('returns wait time when exhausted', () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 2, refillPerSec: 2, now: c.now });
    b.tryAcquire(2);
    // 1/2 sec = 500ms to refill 1
    assert.equal(b.msUntilAvailable(1), 500);
  });
});

describe('TokenBucket — acquire() blocking', () => {
  it('resolves immediately when tokens available', async () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 2, refillPerSec: 1, now: c.now });
    const sleeps = [];
    await b.acquire(1, async (ms) => sleeps.push(ms));
    assert.equal(sleeps.length, 0);
  });

  it('sleeps when exhausted', async () => {
    const c = mockClock();
    const b = new TokenBucket({ capacity: 1, refillPerSec: 2, now: c.now });
    b.tryAcquire();
    const sleeps = [];
    await b.acquire(1, async (ms) => { sleeps.push(ms); c.advance(ms); });
    assert.equal(sleeps.length, 1);
    assert.equal(sleeps[0], 500);
  });
});

describe('Shared singletons', () => {
  it('pineFacadeLimiter and priceAlertsLimiter are real TokenBuckets', () => {
    assert.ok(pineFacadeLimiter instanceof TokenBucket);
    assert.ok(priceAlertsLimiter instanceof TokenBucket);
    // Don't assert on capacity — it's a configuration, not a contract
  });
});
