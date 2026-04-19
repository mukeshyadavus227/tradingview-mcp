/**
 * Smoke tests — src/core/ui.js.
 * Pure helpers (modifierMask, resolveKey, scrollDelta, findLayoutMatch)
 * are already unit-tested. These cover the CDP-dependent exports.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks, fakeCdpClient } from '../helpers/mock-cdp.js';
import * as ui from '../../src/core/ui.js';

describe('core/ui.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_click_smoke');
  it.todo('test_click_smoke_notFound');
  it.todo('test_openPanel_smoke_bottomPanel');
  it.todo('test_openPanel_smoke_sidePanel');
  it.todo('test_fullscreen_smoke');
  it.todo('test_layoutList_smoke');
  it.todo('test_layoutSwitch_smoke');
  it.todo('test_keyboard_smoke');
  it.todo('test_typeText_smoke');
  it.todo('test_hover_smoke');
  it.todo('test_scroll_smoke');
  it.todo('test_mouseClick_smoke_singleClick');
  it.todo('test_mouseClick_smoke_doubleClick');
  it.todo('test_findElement_smoke_css');
  it.todo('test_findElement_smoke_text');
  it.todo('test_uiEvaluate_smoke');
});
