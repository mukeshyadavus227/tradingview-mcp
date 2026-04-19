/**
 * Unit tests for src/core/health.js platform helpers.
 * No TradingView / CDP required.
 *
 * Covers: TV binary path resolution per platform, `which` lookup command,
 * and the kill-TV shell command used before relaunch.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tvCandidatePaths, whichTvCommand, killTvCommand } from '../src/core/health.js';

describe('tvCandidatePaths() — per-platform binary search list', () => {
  it('darwin includes system /Applications path', () => {
    const list = tvCandidatePaths('darwin', { HOME: '/Users/alice' });
    assert.ok(list.includes('/Applications/TradingView.app/Contents/MacOS/TradingView'));
  });

  it('darwin includes per-user $HOME/Applications path', () => {
    const list = tvCandidatePaths('darwin', { HOME: '/Users/alice' });
    assert.ok(list.includes('/Users/alice/Applications/TradingView.app/Contents/MacOS/TradingView'));
  });

  it('win32 uses LOCALAPPDATA, PROGRAMFILES and PROGRAMFILES(X86)', () => {
    const env = {
      LOCALAPPDATA: 'C:\\Users\\bob\\AppData\\Local',
      PROGRAMFILES: 'C:\\Program Files',
      'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
    };
    const list = tvCandidatePaths('win32', env);
    assert.ok(list.includes('C:\\Users\\bob\\AppData\\Local\\TradingView\\TradingView.exe'));
    assert.ok(list.includes('C:\\Program Files\\TradingView\\TradingView.exe'));
    assert.ok(list.includes('C:\\Program Files (x86)\\TradingView\\TradingView.exe'));
  });

  it('linux includes /opt, $HOME/.local/share, /usr/bin and snap paths', () => {
    const list = tvCandidatePaths('linux', { HOME: '/home/alice' });
    assert.ok(list.includes('/opt/TradingView/tradingview'));
    assert.ok(list.includes('/opt/TradingView/TradingView'));
    assert.ok(list.includes('/home/alice/.local/share/TradingView/TradingView'));
    assert.ok(list.includes('/usr/bin/tradingview'));
    assert.ok(list.includes('/snap/tradingview/current/tradingview'));
  });

  it('unknown platform falls back to linux list', () => {
    const linux = tvCandidatePaths('linux', { HOME: '/h' });
    const other = tvCandidatePaths('aix', { HOME: '/h' });
    assert.deepEqual(other, linux);
  });

  it('uses provided env object, not process.env, for deterministic results', () => {
    const a = tvCandidatePaths('darwin', { HOME: '/custom/path-a' });
    const b = tvCandidatePaths('darwin', { HOME: '/custom/path-b' });
    assert.notDeepEqual(a, b);
    assert.ok(a.some(p => p.includes('/custom/path-a')));
    assert.ok(b.some(p => p.includes('/custom/path-b')));
  });
});

describe('whichTvCommand() — path discovery shell', () => {
  it('uses `where TradingView.exe` on win32', () => {
    assert.equal(whichTvCommand('win32'), 'where TradingView.exe');
  });
  it('uses `which tradingview` on darwin', () => {
    assert.equal(whichTvCommand('darwin'), 'which tradingview');
  });
  it('uses `which tradingview` on linux', () => {
    assert.equal(whichTvCommand('linux'), 'which tradingview');
  });
});

describe('killTvCommand() — forced-quit shell', () => {
  it('uses taskkill on win32', () => {
    assert.equal(killTvCommand('win32'), 'taskkill /F /IM TradingView.exe');
  });
  it('uses pkill on darwin/linux', () => {
    assert.equal(killTvCommand('darwin'), 'pkill -f TradingView');
    assert.equal(killTvCommand('linux'), 'pkill -f TradingView');
  });
});
