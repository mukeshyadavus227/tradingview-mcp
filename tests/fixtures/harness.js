/**
 * CDP fixture harness — record/replay for offline e2e tests.
 *
 * In record mode, wraps an evaluate() fn so every (expression, result)
 * pair is persisted. In replay mode, loads the fixture file and answers
 * calls from it. An unknown expression in replay mode throws loudly —
 * so tests fail visibly rather than hitting the network.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const RECORD = process.env.TV_FIXTURE_MODE === 'record';

function keyOf(expression) {
  // Normalize whitespace so record/replay hashes match regardless of
  // formatting differences.
  const normalized = String(expression).replace(/\s+/g, ' ').trim();
  return createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Build a (evaluate, save) pair.
 * @param {string} fixturePath — JSON file path.
 * @param {(expr:string, opts?:object) => Promise<any>} [liveEvaluate]
 *        — only required in RECORD mode.
 */
export function createFixtureHarness(fixturePath, liveEvaluate) {
  let store = {};
  if (existsSync(fixturePath)) {
    store = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  }

  async function evaluate(expression, opts = {}) {
    const k = keyOf(expression);
    if (RECORD) {
      if (!liveEvaluate) throw new Error('RECORD mode requires liveEvaluate');
      const value = await liveEvaluate(expression, opts);
      store[k] = { expression: expression.slice(0, 200), value };
      return value;
    }
    if (!(k in store)) {
      throw new Error(`fixture miss: "${expression.slice(0, 80)}..." — re-record with TV_FIXTURE_MODE=record`);
    }
    return store[k].value;
  }

  function save() {
    writeFileSync(fixturePath, JSON.stringify(store, null, 2));
  }

  return { evaluate, save, _store: store };
}
