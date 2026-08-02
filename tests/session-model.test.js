import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCanvasMock,
  loadOpenShop,
  mountEditorDom,
  quietUiMethods
} from './os-harness.js';

describe('OpenShop workspace/document session model', () => {
  beforeEach(() => {
    localStorage.clear();
    mountEditorDom();
  });

  it('starts with a ready-to-use workspace and no active document owner', () => {
    const OS = loadOpenShop();

    expect(OS.session.application.id).toBe('openshop');
    expect(OS.session.document).toEqual({ activeId: null, openIds: [], name: null });
    expect(OS.session.tool.selectedId).toBe('select');
    expect(OS.session.panels.activeTabs).toEqual({
      ptg1: 'ptg1-layers',
      ptg2: 'ptg2-color',
      ptg3: 'ptg3-history'
    });
    expect(OS.session.preferences).toEqual({ language: 'en', theme: 'default' });
  });

  it('keeps workspace state out of document snapshots', () => {
    const OS = loadOpenShop();
    const boundary = { name: '__boundary__', type: 'rect', visible: true };
    OS.canvas = createCanvasMock([boundary]);
    OS.layers = [{
      id: 'layer-background',
      name: 'Background',
      visible: true,
      locked: false,
      opacity: 100,
      blend: 'source-over',
      objects: [boundary]
    }];
    OS.canvasW = 320;
    OS.canvasH = 240;
    OS._documentId = 'document-1';
    OS._blankWorkspace = false;
    quietUiMethods(OS);
    OS.state.tool = 'brush';
    OS.zoom = 1.75;
    OS._syncSessionWorkspace();

    const snapshot = OS._captureDocumentState();

    expect(snapshot.kind).toBe('openshop-document');
    expect(snapshot.workspace).toBeUndefined();
    expect(OS.session.tool.selectedId).toBe('brush');
    expect(OS.session.viewport.zoom).toBe(1.75);
  });

  it('does not manufacture a document when the blank workspace is serialized', () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    OS.layers = [];
    OS._blankWorkspace = true;
    OS._documentId = null;

    expect(() => OS._captureDocumentState()).toThrow('No active document');
    expect(OS.layers).toEqual([]);
    expect(OS.session.document).toEqual({ activeId: null, openIds: [], name: null });
  });

  it('keeps panel visibility in the workspace session', () => {
    const OS = loadOpenShop();
    const panels = document.getElementById('panels');

    OS.togglePanels();
    expect(OS.session.panels.visible).toBe(false);
    OS.togglePanels();
    expect(OS.session.panels.visible).toBe(true);
    expect(panels.style.display).toBe('');
  });

  it('closes the active document without discarding workspace settings', async () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    OS.canvas.viewportTransform = [1.5, 0, 0, 1.5, 24, 18];
    OS.layers = [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [] }];
    OS.activeLayerIdx = 0;
    OS.canvasW = 800;
    OS.canvasH = 600;
    OS._documentId = 'document-1';
    OS._docName = 'Working copy';
    OS.session.document.activeId = 'document-1';
    OS.state.tool = 'pen';
    OS._lang = 'zh';
    OS._currentTheme = 'midnight';
    OS.zoom = 1.5;
    quietUiMethods(OS);

    await expect(OS.closeDocument({ force: true })).resolves.toBe(true);

    expect(OS.session.document).toEqual({ activeId: null, openIds: [], name: null });
    expect(OS.layers).toEqual([]);
    expect(OS.activeLayerIdx).toBe(-1);
    expect(OS.state.tool).toBe('pen');
    expect(OS._lang).toBe('zh');
    expect(OS._currentTheme).toBe('midnight');
    expect(OS.zoom).toBe(1.5);
    expect(OS.canvas.viewportTransform).toEqual([1.5, 0, 0, 1.5, 24, 18]);
  });

  it('clears only the closed document lineage from recovery storage', async () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    OS._documentId = 'document-old';
    OS._documentIdAliases = ['document-old-alias'];
    OS._blankWorkspace = false;
    OS._docName = 'Old document';
    OS._activeRecoverySourceFilename = 'recovery-old.json';
    OS._clearAutoSave = vi.fn().mockResolvedValue(true);
    quietUiMethods(OS);

    await OS.closeDocument({ force: true });

    expect(OS._clearAutoSave).toHaveBeenCalledWith({
      documentIds: ['document-old', 'document-old-alias'],
      recoveryFilename: 'recovery-old.json'
    });
    expect(OS._activeRecoverySourceFilename).toBeNull();
  });
});
