/**
 * Smoke tests — src/core/pine.js.
 * analyze() and check() pure logic already unit-tested via pine_helpers.
 * These cover the remaining Monaco/DOM-dependent async exports.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as pine from '../../src/core/pine.js';

describe('core/pine.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_ensurePineEditorOpen_smoke_alreadyOpen');
  it.todo('test_ensurePineEditorOpen_smoke_opens');
  it.todo('test_ensurePineEditorOpen_smoke_timeout');
  it.todo('test_getSource_smoke');
  it.todo('test_setSource_smoke');
  it.todo('test_compile_smoke_buttonFound');
  it.todo('test_compile_smoke_keyboardFallback');
  it.todo('test_getErrors_smoke');
  it.todo('test_save_smoke');
  it.todo('test_getConsole_smoke');
  it.todo('test_smartCompile_smoke');
  it.todo('test_newScript_smoke');
  it.todo('test_openScript_smoke');
  it.todo('test_listScripts_smoke');
});
