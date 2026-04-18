/**
 * Unit tests for pure helpers in src/core/capture.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename, buildScreenshotName } from '../src/core/capture.js';

describe('sanitizeFilename()', () => {
  it('strips forward slashes', () => {
    assert.equal(sanitizeFilename('a/b/c'), 'a_b_c');
  });
  it('strips backslashes', () => {
    assert.equal(sanitizeFilename('a\\b\\c'), 'a_b_c');
  });
  it('strips null bytes', () => {
    assert.equal(sanitizeFilename('a\x00b'), 'ab');
  });
  it('strips .. path segments and separators', () => {
    const result = sanitizeFilename('../etc/passwd');
    assert.ok(!result.includes('/'));
    assert.ok(!result.includes('\\'));
    assert.ok(!result.includes('..'));
  });
  it('trims to 200 chars', () => {
    const huge = 'x'.repeat(500);
    assert.equal(sanitizeFilename(huge).length, 200);
  });
  it('handles empty and nullish input', () => {
    assert.equal(sanitizeFilename(''), '');
    assert.equal(sanitizeFilename(null), '');
    assert.equal(sanitizeFilename(undefined), '');
  });
});

describe('buildScreenshotName()', () => {
  const fixedDate = new Date('2025-03-15T12:34:56.789Z');

  it('uses custom name when provided', () => {
    const name = buildScreenshotName('chart', 'my-custom', fixedDate);
    assert.equal(name, 'my-custom.png');
  });
  it('auto-names with region and timestamp', () => {
    const name = buildScreenshotName('chart', null, fixedDate);
    assert.equal(name, 'tv_chart_2025-03-15T12-34-56-789Z.png');
  });
  it('defaults region to full when missing', () => {
    const name = buildScreenshotName(null, null, fixedDate);
    assert.match(name, /^tv_full_/);
  });
  it('sanitizes a malicious custom name', () => {
    const name = buildScreenshotName('chart', '../../etc/shadow', fixedDate);
    assert.ok(!name.includes('/'));
    assert.ok(!name.includes('..'));
  });
  it('always ends in .png', () => {
    assert.match(buildScreenshotName('chart', 'foo', fixedDate), /\.png$/);
    assert.match(buildScreenshotName('chart', null, fixedDate), /\.png$/);
  });
});
