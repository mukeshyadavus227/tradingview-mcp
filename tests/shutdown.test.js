/**
 * Unit tests for the graceful-shutdown coordinator.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onShutdown, _resetForTests, _triggerShutdown } from '../src/shutdown.js';

describe('shutdown coordinator', () => {
  beforeEach(() => _resetForTests());

  it('runs registered handlers on trigger', async () => {
    const log = [];
    onShutdown('a', () => log.push('a'));
    onShutdown('b', () => log.push('b'));
    await _triggerShutdown('test');
    // Reverse order (last-in first-out)
    assert.deepEqual(log, ['b', 'a']);
  });

  it('awaits async handlers', async () => {
    const log = [];
    onShutdown('slow', async () => {
      await new Promise(r => setTimeout(r, 10));
      log.push('slow');
    });
    await _triggerShutdown('test');
    assert.deepEqual(log, ['slow']);
  });

  it('does not re-enter if triggered twice concurrently', async () => {
    let calls = 0;
    onShutdown('once', () => { calls++; });
    await Promise.all([_triggerShutdown('a'), _triggerShutdown('b')]);
    assert.equal(calls, 1);
  });

  it('enforces per-handler timeout', async () => {
    const log = [];
    onShutdown('stuck', () => new Promise(() => { /* never resolves */ }));
    onShutdown('next',  () => log.push('next'));
    const t0 = Date.now();
    await _triggerShutdown('test', { timeoutMs: 50 });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 500, `took too long: ${elapsed}ms`);
    assert.deepEqual(log, ['next']);
  });

  it('continues if one handler throws', async () => {
    const log = [];
    onShutdown('boom', () => { throw new Error('kaboom'); });
    onShutdown('ok',   () => log.push('ok'));
    await _triggerShutdown('test');
    assert.deepEqual(log, ['ok']);
  });

  it('unregister function removes a handler', async () => {
    const log = [];
    const unreg = onShutdown('x', () => log.push('x'));
    unreg();
    await _triggerShutdown('test');
    assert.deepEqual(log, []);
  });
});
