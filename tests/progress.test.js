/**
 * Unit tests for src/progress.js reporters.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nullReporter, memoryReporter, ensureReporter } from '../src/progress.js';

describe('nullReporter', () => {
  it('update/log are no-ops and never throw', () => {
    nullReporter.update(0.5, 'x');
    nullReporter.log('msg');
  });
});

describe('memoryReporter()', () => {
  it('records update events in order', () => {
    const r = memoryReporter();
    r.update(0.1, 'a');
    r.update(0.5, 'b');
    r.update(1.0, 'c');
    assert.equal(r.events.length, 3);
    assert.equal(r.events[0].type, 'update');
    assert.equal(r.events[0].pct, 0.1);
    assert.equal(r.events[2].message, 'c');
  });

  it('records log events', () => {
    const r = memoryReporter();
    r.log('hello');
    assert.deepEqual(r.events, [{ type: 'log', msg: 'hello' }]);
  });
});

describe('ensureReporter()', () => {
  it('returns a reporter for undefined input', () => {
    const r = ensureReporter(undefined);
    assert.equal(typeof r.update, 'function');
    assert.equal(typeof r.log, 'function');
    r.update(0.5);
    r.log('x');
  });

  it('adopts custom update/log fns', () => {
    let pct = null, msg = null;
    const r = ensureReporter({
      update: (p, m) => { pct = p; msg = m; },
      log: () => {},
    });
    r.update(0.7, 'hello');
    assert.equal(pct, 0.7);
    assert.equal(msg, 'hello');
  });

  it('fills in missing methods with no-ops', () => {
    const r = ensureReporter({ update: () => {} });
    r.log('ignored');
  });
});
