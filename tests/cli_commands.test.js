/**
 * CLI command-handler offline tests.
 * Covers help output, subcommand routing, missing-argument validation,
 * JSON error envelope, and offline pine-analyze invocations.
 *
 * No TradingView connection required.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'src', 'cli', 'index.js');

function run(args, opts = {}) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      timeout: 10_000,
      ...opts,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || '',
      exitCode: err.status,
    };
  }
}

describe('CLI — help output for each command group', () => {
  const groups = ['status', 'launch', 'state', 'ohlcv', 'values', 'pine', 'data', 'replay',
                  'draw', 'alert', 'watchlist', 'indicator', 'pane', 'tab', 'stream'];
  for (const g of groups) {
    it(`tv ${g} --help exits 0 with usage text`, () => {
      const { exitCode, stdout } = run([g, '--help']);
      assert.equal(exitCode, 0, `tv ${g} --help exited with ${exitCode}`);
      assert.ok(stdout.includes(`tv ${g}`) || stdout.includes('Usage'),
        `tv ${g} --help missing usage text`);
    });
  }
});

describe('CLI — missing-argument validation errors', () => {
  it('tv scroll without date errors with usage hint', () => {
    const { exitCode, stderr } = run(['scroll']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Date required/);
  });

  it('tv search without query errors', () => {
    const { exitCode, stderr } = run(['search']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Query required/);
  });

  it('tv pine open without name errors', () => {
    const { exitCode, stderr } = run(['pine', 'open']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Script name required/);
  });

  it('tv pine set with no stdin and no --file errors', () => {
    const { exitCode, stderr } = run(['pine', 'set'], { input: '' });
    assert.equal(exitCode, 1);
    assert.match(stderr, /No source provided/);
  });

  it('tv pine analyze with no input errors', () => {
    const { exitCode, stderr } = run(['pine', 'analyze'], { input: '' });
    assert.equal(exitCode, 1);
    assert.match(stderr, /No source provided/);
  });

  it('tv data indicator without entity ID errors', () => {
    const { exitCode, stderr } = run(['data', 'indicator']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Entity ID required/);
  });
});

describe('CLI — routing errors', () => {
  it('unknown top-level command exits 1', () => {
    const { exitCode, stderr } = run(['bogus-cmd']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Unknown command/);
  });

  it('unknown subcommand under pine exits 1', () => {
    const { exitCode, stderr } = run(['pine', 'bogus-sub']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Unknown subcommand/);
  });

  it('unknown subcommand under data exits 1', () => {
    const { exitCode, stderr } = run(['data', 'bogus-sub']);
    assert.equal(exitCode, 1);
    assert.match(stderr, /Unknown subcommand/);
  });

  it('pine without subcommand prints subcommand help and exits 0', () => {
    const { exitCode, stdout } = run(['pine']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /analyze|compile|get/);
  });

  it('data without subcommand prints subcommand help and exits 0', () => {
    const { exitCode, stdout } = run(['data']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /lines|labels|tables|boxes/);
  });
});

describe('CLI — JSON error envelope on handler failure', () => {
  it('tv scroll with no date emits parseable JSON error on stderr', () => {
    const { exitCode, stderr } = run(['scroll']);
    assert.equal(exitCode, 1);
    const parsed = JSON.parse(stderr.trim());
    assert.equal(parsed.success, false);
    assert.ok(parsed.error);
  });
});

describe('CLI — pipe-friendly JSON on offline-capable commands', () => {
  it('pine analyze via stdin returns parseable JSON to stdout', () => {
    const src = '//@version=6\nindicator("ok")\nplot(close)';
    const { exitCode, stdout } = run(['pine', 'analyze'], { input: src });
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.success, true);
    assert.equal(parsed.issue_count, 0);
  });

  it('pine analyze --file reads source from disk', () => {
    const tmp = join(__dirname, '_tmp_analyze.pine');
    writeFileSync(tmp, '//@version=6\nindicator("ok")\nplot(close)', 'utf-8');
    try {
      const { exitCode, stdout } = run(['pine', 'analyze', '--file', tmp]);
      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.success, true);
    } finally {
      unlinkSync(tmp);
    }
  });

  it('pine analyze --file reports diagnostics when script has issues', () => {
    const tmp = join(__dirname, '_tmp_analyze_bad.pine');
    writeFileSync(tmp, '//@version=6\nindicator("oob")\na = array.new_int(3)\nx = array.get(a, 5)', 'utf-8');
    try {
      const { exitCode, stdout } = run(['pine', 'analyze', '--file', tmp]);
      assert.equal(exitCode, 0);
      const parsed = JSON.parse(stdout);
      assert.ok(parsed.issue_count >= 1);
      assert.match(parsed.diagnostics[0].message, /out of bounds/);
    } finally {
      unlinkSync(tmp);
    }
  });
});
