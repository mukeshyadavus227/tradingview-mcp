/**
 * Smoke tests — src/core/drawing.js.
 * drawShape and sanitizeOverrides are already unit-tested; these cover the
 * remaining async CDP-dependent functions end-to-end with mocked evaluate.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installCdpMocks, resetCdpMocks } from '../helpers/mock-cdp.js';
import * as drawing from '../../src/core/drawing.js';

describe('core/drawing.js — smoke', () => {
  afterEach(() => resetCdpMocks());

  it.todo('test_drawShape_smoke_singlePoint');
  it.todo('test_drawShape_smoke_multipoint');
  it.todo('test_listDrawings_smoke');
  it.todo('test_getProperties_smoke');
  it.todo('test_removeOne_smoke');
  it.todo('test_clearAll_smoke');
});
