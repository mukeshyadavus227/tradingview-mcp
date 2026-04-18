/**
 * Unit tests for pure helpers in src/core/pine.js.
 * No TradingView / CDP required.
 * Covers: pine-facade error/warning parsing, compile result formatting,
 * new-script template resolution, and script-name matching.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePineFacadeResponse,
  formatCompileResult,
  getTemplateForType,
  findScriptMatch,
} from '../src/core/pine.js';

// ── parsePineFacadeResponse ─────────────────────────────────────────────

describe('parsePineFacadeResponse()', () => {
  it('returns empty arrays for an empty response', () => {
    const { errors, warnings } = parsePineFacadeResponse({});
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  it('returns empty arrays for undefined/null', () => {
    assert.deepEqual(parsePineFacadeResponse(undefined).errors, []);
    assert.deepEqual(parsePineFacadeResponse(null).errors, []);
  });

  it('extracts errors2 entries with start/end coords', () => {
    const resp = { result: { errors2: [
      { start: { line: 3, column: 5 }, end: { line: 3, column: 12 }, message: 'Undeclared identifier' },
    ]}};
    const { errors } = parsePineFacadeResponse(resp);
    assert.equal(errors.length, 1);
    assert.deepEqual(errors[0], {
      line: 3, column: 5, end_line: 3, end_column: 12, message: 'Undeclared identifier',
    });
  });

  it('extracts warnings2 entries', () => {
    const resp = { result: { warnings2: [
      { start: { line: 7, column: 1 }, message: 'Deprecated' },
    ]}};
    const { warnings } = parsePineFacadeResponse(resp);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].message, 'Deprecated');
    assert.equal(warnings[0].line, 7);
  });

  it('tolerates missing start/end coordinates', () => {
    const resp = { result: { errors2: [{ message: 'Generic' }] } };
    const { errors } = parsePineFacadeResponse(resp);
    assert.equal(errors[0].message, 'Generic');
    assert.equal(errors[0].line, undefined);
  });

  it('promotes a top-level result.error string into errors array', () => {
    const { errors } = parsePineFacadeResponse({ error: 'Service unavailable' });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'Service unavailable');
  });

  it('ignores non-array errors2/warnings2 fields', () => {
    const { errors, warnings } = parsePineFacadeResponse({
      result: { errors2: 'bad', warnings2: null },
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });
});

// ── formatCompileResult ─────────────────────────────────────────────────

describe('formatCompileResult()', () => {
  it('compiled=true when errors empty', () => {
    const r = formatCompileResult([], []);
    assert.equal(r.compiled, true);
    assert.equal(r.error_count, 0);
    assert.equal(r.warning_count, 0);
    assert.equal(r.errors, undefined);
    assert.equal(r.warnings, undefined);
    assert.match(r.note, /compiled successfully/);
  });

  it('compiled=false when any errors present', () => {
    const r = formatCompileResult([{ message: 'x' }], []);
    assert.equal(r.compiled, false);
    assert.equal(r.error_count, 1);
    assert.ok(r.errors);
    assert.equal(r.note, undefined);
  });

  it('includes warnings when non-empty', () => {
    const r = formatCompileResult([], [{ message: 'w' }]);
    assert.equal(r.warning_count, 1);
    assert.ok(r.warnings);
    assert.equal(r.compiled, true);
  });

  it('omits errors/warnings fields when empty (keeps output compact)', () => {
    const r = formatCompileResult([], []);
    assert.ok(!('errors' in r) || r.errors === undefined);
    assert.ok(!('warnings' in r) || r.warnings === undefined);
  });
});

// ── getTemplateForType ──────────────────────────────────────────────────

describe('getTemplateForType()', () => {
  it('returns indicator template for "indicator"', () => {
    const t = getTemplateForType('indicator');
    assert.match(t, /indicator\(/);
    assert.match(t, /@version=6/);
    assert.match(t, /plot\(close\)/);
  });

  it('returns strategy template for "strategy"', () => {
    const t = getTemplateForType('strategy');
    assert.match(t, /strategy\(/);
    assert.match(t, /@version=6/);
  });

  it('returns library template for "library"', () => {
    const t = getTemplateForType('library');
    assert.match(t, /library\(/);
    assert.match(t, /@version=6/);
  });

  it('defaults to indicator for unknown type', () => {
    const t = getTemplateForType('banana');
    assert.match(t, /indicator\(/);
  });

  it('defaults to indicator when type is undefined', () => {
    const t = getTemplateForType(undefined);
    assert.match(t, /indicator\(/);
  });
});

// ── findScriptMatch ─────────────────────────────────────────────────────

describe('findScriptMatch()', () => {
  const scripts = [
    { scriptIdPart: 'id_1', scriptName: 'NY Levels',    scriptTitle: 'NY Levels' },
    { scriptIdPart: 'id_2', scriptName: 'Volume Profile', scriptTitle: 'Volume Profile' },
    { scriptIdPart: 'id_3', scriptName: 'NY Levels Pro', scriptTitle: 'NY Levels Pro' },
  ];

  it('prefers exact match on scriptName (case-insensitive)', () => {
    const m = findScriptMatch(scripts, 'ny levels');
    assert.equal(m.scriptIdPart, 'id_1');
  });

  it('falls back to substring match when no exact match', () => {
    const m = findScriptMatch(scripts, 'profile');
    assert.equal(m.scriptIdPart, 'id_2');
  });

  it('returns the first substring hit', () => {
    const m = findScriptMatch(scripts, 'levels');
    assert.equal(m.scriptIdPart, 'id_1');
  });

  it('returns undefined when no match', () => {
    assert.equal(findScriptMatch(scripts, 'nope'), undefined);
  });

  it('returns undefined when scripts is missing', () => {
    assert.equal(findScriptMatch(null, 'x'), undefined);
    assert.equal(findScriptMatch([], 'x'), undefined);
  });

  it('returns undefined when query is missing', () => {
    assert.equal(findScriptMatch(scripts, ''), undefined);
    assert.equal(findScriptMatch(scripts, null), undefined);
  });

  it('matches on scriptTitle when scriptName is missing', () => {
    const list = [{ scriptIdPart: 'a', scriptTitle: 'Only Title' }];
    const m = findScriptMatch(list, 'only title');
    assert.equal(m.scriptIdPart, 'a');
  });
});
