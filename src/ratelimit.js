/**
 * Token-bucket rate limiter.
 *
 * Used to throttle outbound requests to tradingview.com APIs
 * (pine-facade, pricealerts, etc.) so a misbehaving agent can't
 * get the user's IP rate-limited.
 */

export class TokenBucket {
  /**
   * @param {object} opts
   * @param {number} opts.capacity    — max tokens (burst size)
   * @param {number} opts.refillPerSec — tokens added per second
   * @param {() => number} [opts.now]  — clock injection for tests
   */
  constructor({ capacity, refillPerSec, now = Date.now } = {}) {
    if (!(capacity > 0)) throw new Error('capacity must be > 0');
    if (!(refillPerSec > 0)) throw new Error('refillPerSec must be > 0');
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.tokens = capacity;
    this.lastRefill = now();
    this._now = now;
  }

  _refill() {
    const t = this._now();
    const elapsed = (t - this.lastRefill) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.lastRefill = t;
    }
  }

  /** Try to consume n tokens synchronously. Returns true on success. */
  tryAcquire(n = 1) {
    this._refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  /** Milliseconds until n tokens are available. */
  msUntilAvailable(n = 1) {
    this._refill();
    if (this.tokens >= n) return 0;
    const needed = n - this.tokens;
    return Math.ceil((needed / this.refillPerSec) * 1000);
  }

  /**
   * Block until n tokens are available, then consume them.
   * @param {number} n
   * @param {(ms:number)=>Promise<void>} [sleep]
   */
  async acquire(n = 1, sleep = (ms) => new Promise(r => setTimeout(r, ms))) {
    while (!this.tryAcquire(n)) {
      await sleep(this.msUntilAvailable(n));
    }
  }
}

// Shared singletons for known upstream APIs.
// pine-facade: modest default — ~2 req/sec, burst of 5.
export const pineFacadeLimiter = new TokenBucket({ capacity: 5, refillPerSec: 2 });
// pricealerts: ~1 req/sec, burst of 3.
export const priceAlertsLimiter = new TokenBucket({ capacity: 3, refillPerSec: 1 });
