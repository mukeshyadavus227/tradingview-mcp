/**
 * Unit tests for the CDP fixture record/replay harness.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFixtureHarness } from './fixtures/harness.js';

function tempPath(name) {
  const dir = mkdtempSync(join(tmpdir(), 'tv-fix-'));
  return { path: join(dir, name), dir };
}

describe('fixture harness — replay mode', () => {
  it('returns recorded value for a known expression', async () => {
    const { path, dir } = tempPath('fix.json');
    try {
      writeFileSync(path, JSON.stringify({
        '26c19af0b33481d8': { expression: '1 + 1', value: 2 },
      }));
      const { evaluate } = createFixtureHarness(path);
      const v = await evaluate('1 + 1');
      assert.equal(v, 2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('matches regardless of whitespace differences', async () => {
    const { path, dir } = tempPath('fix.json');
    try {
      // Same content different formatting
      const { evaluate: record, save } = createFixtureHarness(path, async () => 'hello');
      // Manually simulate a record pass via monkey-patching env:
      process.env.TV_FIXTURE_MODE = 'record';
      try {
        // Re-import harness fresh so RECORD binding sees the new env
        const { createFixtureHarness: freshHarness } = await import('./fixtures/harness.js?rec');
        const h = freshHarness(path, async () => 42);
        await h.evaluate('return   foo()');
        h.save();
      } finally { delete process.env.TV_FIXTURE_MODE; }

      const { evaluate: replay } = createFixtureHarness(path);
      // Differently-spaced but equivalent expression should still hit
      const v = await replay('return foo()');
      assert.equal(v, 42);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('throws on unknown expression in replay mode', async () => {
    const { path, dir } = tempPath('fix.json');
    try {
      writeFileSync(path, '{}');
      const { evaluate } = createFixtureHarness(path);
      await assert.rejects(() => evaluate('unrecorded'), /fixture miss/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('empty fixture file is handled', async () => {
    const { path, dir } = tempPath('fix.json');
    try {
      writeFileSync(path, '{}');
      const { evaluate } = createFixtureHarness(path);
      await assert.rejects(() => evaluate('x'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('fixture harness — record mode', () => {
  it('persists expressions to disk and returns live values', async () => {
    const { path, dir } = tempPath('fix.json');
    try {
      process.env.TV_FIXTURE_MODE = 'record';
      try {
        const { createFixtureHarness: fresh } = await import('./fixtures/harness.js?record-test');
        const { evaluate, save } = fresh(path, async (e) => (e === 'a+b' ? 7 : null));
        const v = await evaluate('a+b');
        assert.equal(v, 7);
        save();
        const persisted = JSON.parse(readFileSync(path, 'utf-8'));
        const keys = Object.keys(persisted);
        assert.equal(keys.length, 1);
        assert.equal(persisted[keys[0]].value, 7);
      } finally { delete process.env.TV_FIXTURE_MODE; }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
