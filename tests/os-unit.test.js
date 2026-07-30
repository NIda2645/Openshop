import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createCanvasMock,
  installFabricMock,
  installModalDelegation,
  loadOpenShop,
  mountEditorDom,
  quietUiMethods
} from './os-harness.js';

describe('OpenShop core object', () => {
  beforeEach(() => {
    localStorage.clear();
    window.showSaveFilePicker = undefined;
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
    installFabricMock();
    installModalDelegation();
    mountEditorDom();
  });

  it('switches tools and updates canvas interaction state', () => {
    const OS = loadOpenShop();
    const object = { name: 'Layer Object', selectable: false, evented: false };
    OS.canvas = createCanvasMock([object]);
    quietUiMethods(OS);

    OS.setTool('brush');

    expect(OS.state.tool).toBe('brush');
    expect(OS.canvas.isDrawingMode).toBe(true);
    expect(document.querySelector('[data-tool="brush"]').classList.contains('active')).toBe(true);
    expect(document.getElementById('opt-brush').style.display).toBe('flex');

    OS.setTool('select');

    expect(OS.canvas.selection).toBe(true);
    expect(OS.canvas.defaultCursor).toBe('default');
    expect(object.selectable).toBe(true);
    expect(object.evented).toBe(true);

    OS.setTool('ai-segment');

    expect(OS.state.tool).toBe('ai-segment');
    expect(OS.canvas.defaultCursor).toBe('crosshair');
    expect(document.querySelector('[data-tool="ai-segment"]').classList.contains('active')).toBe(true);
    expect(document.getElementById('opt-ai-segment').style.display).toBe('flex');
  });

  it('adds and deletes layers while keeping canvas objects in sync', () => {
    const OS = loadOpenShop();
    const canvasObject = { name: 'Pixel Layer', type: 'image' };
    OS.canvas = createCanvasMock([canvasObject]);
    quietUiMethods(OS);
    OS.saveHistory = vi.fn();

    OS.addLayer();

    expect(OS.layers).toHaveLength(1);
    expect(OS.layers[0].name).toBe('Layer 0');
    expect(OS.activeLayerIdx).toBe(0);
    expect(OS.saveHistory).toHaveBeenCalledWith(
      'New Layer',
      expect.objectContaining({ command: expect.objectContaining({ id: 'layer.add', schemaVersion: 1 }) })
    );

    OS.layers[0].objects.push(canvasObject);
    OS.deleteLayer();

    expect(OS.canvas.remove).toHaveBeenCalledWith(canvasObject);
    expect(OS.layers).toHaveLength(1);
    expect(OS.layers[0].name).toBe('Layer 0');
    expect(OS.layers[0].objects).toHaveLength(0);
    expect(OS.saveHistory).toHaveBeenCalledWith(
      'Delete Layer',
      expect.objectContaining({ command: expect.objectContaining({ id: 'layer.delete', schemaVersion: 1 }) })
    );
  });

  it('keeps layer ownership, canvas stacking, and edit eligibility canonical', () => {
    const OS = loadOpenShop();
    const bottom = { name: 'Bottom', visible: true, selectable: true, evented: true };
    const middle = { name: 'Middle', visible: true, selectable: true, evented: true };
    const top = { name: 'Top', visible: true, selectable: true, evented: true };
    OS.canvas = createCanvasMock([top, bottom, middle]);
    quietUiMethods(OS);
    OS.layers = [
      { id: 'layer-bottom', name: 'Bottom', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [bottom] },
      { id: 'layer-middle', name: 'Middle', visible: true, locked: true, opacity: 100, blend: 'source-over', objects: [middle] },
      { id: 'layer-top', name: 'Top', visible: false, locked: false, opacity: 100, blend: 'source-over', objects: [top] }
    ];
    OS.activeLayerIdx = 1;
    OS.state.tool = 'select';

    OS._enforceLayerInvariants();

    expect(OS.canvas.getObjects()).toEqual([bottom, middle, top]);
    expect(OS._getObjectLayerIndex(bottom)).toBe(0);
    expect(OS._getObjectLayerIndex(middle)).toBe(1);
    expect(OS._getObjectLayerIndex(top)).toBe(2);
    expect(bottom).toMatchObject({ visible: true, selectable: true, evented: true });
    expect(middle).toMatchObject({ visible: true, selectable: false, evented: false });
    expect(top).toMatchObject({ visible: false, selectable: false, evented: false });

    OS.setTool('brush');
    expect(OS.canvas.isDrawingMode).toBe(false);
    OS.layers[1].locked = false;
    OS._applyLayerInteractionState();
    expect(OS.canvas.isDrawingMode).toBe(true);
  });

  it('records layer properties and reorders the canvas with the layer model', () => {
    const OS = loadOpenShop();
    const lower = { name: 'Lower', visible: true };
    const upper = { name: 'Upper', visible: true };
    OS.canvas = createCanvasMock([lower, upper]);
    quietUiMethods(OS);
    OS.saveHistory = vi.fn();
    OS.layers = [
      { id: 'layer-lower', name: 'Lower', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [lower] },
      { id: 'layer-upper', name: 'Upper', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [upper] }
    ];
    OS.activeLayerIdx = 1;

    OS.toggleLayerVisibility(1);
    OS.toggleLayerVisibility(1);
    OS.toggleLayerLock(1);
    OS.toggleLayerLock(1);
    OS.setLayerOpacity(55);
    OS.renameLayer(1, 'Renamed');
    expect(OS._moveLayer(1, 0)).toBe(true);

    expect(OS.layers.map((layer) => layer.name)).toEqual(['Renamed', 'Lower']);
    expect(OS.canvas.getObjects()).toEqual([upper, lower]);
    expect(upper.opacity).toBe(0.55);
    expect(OS.saveHistory.mock.calls.map(([action]) => action)).toEqual([
      'Hide Layer',
      'Show Layer',
      'Lock Layer',
      'Unlock Layer',
      'Layer Opacity',
      'Rename Layer',
      'Reorder Layers'
    ]);
  });

  it('restores prior snapshots through undo and redo', async () => {
    const OS = loadOpenShop();
    const canvas = createCanvasMock();
    let snapshotName = 'Initial';
    canvas.toJSON = vi.fn(() => ({ objects: [{ name: snapshotName }] }));
    const restored = [];
    canvas.loadFromJSON = vi.fn((json, callback) => {
      restored.push(json.objects[0].name);
      callback?.();
    });
    OS.canvas = canvas;
    quietUiMethods(OS);
    OS.rebuildLayersFromCanvas = vi.fn();
    OS.setTool = vi.fn();

    OS.saveHistory('Initial');
    snapshotName = 'Edited';
    OS.saveHistory('Edited');

    await OS.undo();
    await OS.redo();

    expect(restored).toEqual(['Initial', 'Edited']);
    expect(OS.historyIdx).toBe(1);
    expect(OS.setTool).toHaveBeenCalledWith('select');
  });

  it('keeps initialization out of transaction history and validates versioned action files', () => {
    const OS = loadOpenShop();
    const object = { name: 'Subject', type: 'rect' };
    OS.canvas = createCanvasMock([object]);
    OS.layers = [{ id: 'layer-subject', name: 'Subject', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [object] }];
    OS.activeLayerIdx = 0;
    quietUiMethods(OS);

    OS._initializeHistory('New Document');

    expect(OS.history).toEqual([]);
    expect(OS.historyIdx).toBe(-1);
    expect(OS._historyBaseSnapshot).toContain('"kind":"openshop-document"');
    expect(OS._historyBaseLabel).toBe('New Document');

    const command = OS._makeCommand('layer.opacity.set', { layerId: 'layer-subject', opacity: 55 });
    const parsed = OS._parseMacroPayload({
      kind: 'openshop-command-sequence',
      schemaVersion: 1,
      commands: [command]
    });
    expect(parsed).toEqual([command]);
    expect(() => OS._parseMacroPayload([{ action: 'setLayerOpacity', params: [55] }])).toThrow('Unsupported command schema');
    expect(() => OS._makeCommand('layer.opacity.set', { layerId: 'layer-subject', opacity: 101 })).toThrow('out of range');
    expect(() => OS._makeCommand('_privateMethod', {})).toThrow('Unknown command');
  });

  it('exports PNG using a sanitized download name', () => {
    const OS = loadOpenShop();
    const boundary = {
      name: '__boundary__',
      opacity: 1,
      fill: 'transparent',
      set(property, value) {
        this[property] = value;
      }
    };
    OS.canvas = createCanvasMock([boundary]);
    quietUiMethods(OS);
    OS._docName = 'Client Proof 01';
    const clicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicks.push({ download: this.download, href: this.href });
    });

    OS.saveFile('png');

    expect(OS.canvas.toDataURL).toHaveBeenCalledWith({
      format: 'png',
      quality: 1,
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      multiplier: 1
    });
    expect(clicks[0].download).toBe('Client_Proof_01.png');
    expect(boundary.opacity).toBe(1);
    expect(OS.toast).toHaveBeenCalledWith('Exported as PNG', 'success');
  });

  it('restores temporary export state and dirty metadata when encoding fails', () => {
    const OS = loadOpenShop();
    const boundary = {
      name: '__boundary__',
      opacity: 0.65,
      visible: true,
      fill: 'checker',
      excludeFromExport: false,
      set(property, value) {
        this[property] = value;
      }
    };
    const canvas = createCanvasMock([boundary]);
    canvas.viewportTransform = [1.5, 0, 0, 1.5, 23, 17];
    canvas.backgroundColor = '#123456';
    canvas.toDataURL.mockImplementation(() => {
      throw new Error('Synthetic encoder failure');
    });
    OS.canvas = canvas;
    OS.layers = [{ id: 'layer-background', name: 'Background', visible: true, locked: true, opacity: 100, blend: 'source-over', objects: [boundary] }];
    OS.activeLayerIdx = 0;
    quietUiMethods(OS);
    OS._isDirty = true;
    OS._autoSaveDirty = true;
    OS._documentRevision = 7;
    OS._persistenceState = 'dirty';

    expect(OS.saveFile('png')).toBe(false);

    expect(canvas.viewportTransform).toEqual([1.5, 0, 0, 1.5, 23, 17]);
    expect(canvas.backgroundColor).toBe('#123456');
    expect(boundary).toMatchObject({
      opacity: 0.65,
      visible: true,
      fill: 'checker',
      excludeFromExport: false
    });
    expect(OS._isDirty).toBe(true);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._documentRevision).toBe(7);
    expect(OS._persistenceState).toBe('dirty');
    expect(OS.toast).toHaveBeenCalledWith('Export failed: Synthetic encoder failure', 'error');
  });

  it('routes keyboard shortcuts to undo, redo, save, and tool selection', () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    quietUiMethods(OS);
    OS.undo = vi.fn();
    OS.redo = vi.fn();
    OS.saveProject = vi.fn();
    OS.setTool = vi.fn();

    OS._initKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));

    expect(OS.undo).toHaveBeenCalledTimes(1);
    expect(OS.redo).toHaveBeenCalledTimes(1);
    expect(OS.saveProject).toHaveBeenCalledTimes(1);
    expect(OS.setTool).toHaveBeenCalledWith('brush');
  });

  it('mirrors canvas state into hidden accessibility nodes', () => {
    const OS = loadOpenShop();
    const canvasObject = { name: 'Subject', type: 'image' };
    OS.canvas = createCanvasMock([canvasObject]);
    OS.cancelCrop = vi.fn();
    OS.updateInfoPanel = vi.fn();
    OS.updateMinimap = vi.fn();
    OS.updateHistogram = vi.fn();
    OS.updateHistoryPanel = vi.fn();
    OS.recordMacroStep = vi.fn();
    OS.layers = [
      { name: 'Background', visible: true, locked: true, opacity: 100, blend: 'source-over', objects: [] },
      { name: 'Subject Layer', visible: true, locked: false, opacity: 80, blend: 'multiply', objects: [canvasObject] }
    ];
    OS.activeLayerIdx = 1;
    OS._selectionBounds = { x: 4, y: 6, w: 10, h: 12 };
    OS._selectionMask = { w: 20, h: 20, mask: new Uint8Array(400) };
    OS._selectionMask.mask[0] = 1;
    OS._selectionMask.mask[1] = 1;

    OS.setTool('ai-segment');
    OS._lastAction = 'Filter: Sharpen';
    OS._renderAccessibilityTree();
    OS.toast('Filter applied', 'success');

    expect(document.getElementById('canvas-a11y-tool').textContent).toBe('Tool: AI Segment');
    expect(document.getElementById('canvas-a11y-layer').textContent).toContain('Subject Layer');
    expect(document.getElementById('canvas-a11y-layer').textContent).toContain('multiply');
    expect(document.getElementById('canvas-a11y-selection').textContent).toContain('2 pixels selected');
    expect(document.getElementById('canvas-a11y-summary').textContent).toContain('Last action: Filter: Sharpen');
    expect(document.getElementById('canvas-a11y-live').textContent).toBe('Filter applied');
    expect(document.getElementById('canvas-area').getAttribute('aria-label')).toContain('Tool: AI Segment');
    expect(document.querySelectorAll('#canvas-a11y-layers li')).toHaveLength(2);
  });

  it('renders persisted recent files, palettes, and presets as inert DOM', () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    OS.cancelCrop = vi.fn();
    const payload = '<img src=x onerror=alert(1)>';
    localStorage.setItem('openshop_recent', JSON.stringify([
      { name: payload, dims: '<svg onload=alert(2)>', date: '<script>alert(3)</script>' }
    ]));
    localStorage.setItem('os_palette', JSON.stringify([
      '#112233',
      'url(javascript:alert(1))',
      '#AABBCC',
      '<img src=x onerror=alert(1)>'
    ]));
    localStorage.setItem('os_presets', JSON.stringify([
      { name: payload, adjustments: { brightness: '20', contrast: 'bad' }, custom: true }
    ]));

    OS.populateRecentFiles();
    OS.loadSavedPalette();
    OS.showPresets();

    expect(document.querySelector('#recent-files-area img')).toBeNull();
    expect(document.querySelector('#recent-files-area script')).toBeNull();
    expect(document.getElementById('recent-files-area').textContent).toContain(payload);
    expect(document.querySelectorAll('#palette-saved .palette-swatch')).toHaveLength(2);
    expect([...document.querySelectorAll('#palette-saved .palette-swatch')].map(el => el.title)).toEqual(['#112233', '#aabbcc']);
    const presetModal = document.querySelector('.modal-overlay .modal');
    expect(presetModal.querySelector('img')).toBeNull();
    expect(presetModal.querySelector('script')).toBeNull();
    expect(presetModal.textContent).toContain(payload);
  });

  it('renders dynamic command, context, note, timeline, macro, and AI UI as inert DOM', () => {
    const OS = loadOpenShop();
    const payload = '<img src=x onerror=alert(1)>';
    const active = {
      name: 'Photo',
      type: 'image',
      bringToFront: vi.fn(),
      bringForward: vi.fn(),
      sendBackwards: vi.fn(),
      sendToBack: vi.fn()
    };
    const canvas = createCanvasMock([active]);
    canvas.setActiveObject(active);
    OS.canvas = canvas;
    quietUiMethods(OS);

    OS._getCommands = () => [{ label: payload, cat: '<script>alert(2)</script>', key: '<svg onload=alert(3)>', fn: vi.fn() }];
    OS.filterCommands('');
    expect(document.querySelector('#cmd-results img')).toBeNull();
    expect(document.getElementById('cmd-results').textContent).toContain(payload);

    OS._lastFilter = payload;
    OS.initContextMenu();
    document.getElementById('canvas-area').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 4, clientY: 6 }));
    expect(document.querySelector('#context-menu img')).toBeNull();
    expect(document.getElementById('context-menu').textContent).toContain(payload);

    OS.addStickyNote({ clientX: 10, clientY: 20 });
    expect(document.querySelector('#sticky-container [onclick]')).toBeNull();
    expect(document.querySelector('#sticky-container textarea').placeholder).toBe('Type a note...');

    OS.canvasW = 2;
    OS.canvasH = 2;
    OS._animFrames = ['data:image/png;base64,TEST'];
    OS._renderFrames();
    expect(document.querySelector('#timeline-frames [onclick]')).toBeNull();
    expect(document.getElementById('timeline-frames').textContent).toContain('#1');

    OS._macroSteps = [{ action: payload }];
    OS._renderMacroList();
    expect(document.querySelector('#macro-list img')).toBeNull();
    expect(document.getElementById('macro-list').textContent).toContain(payload);

    OS._showAIProgress(payload, '<script>alert(4)</script>');
    expect(document.querySelector('#ai-title img')).toBeNull();
    expect(document.getElementById('ai-title').textContent).toContain(payload);
    expect(document.getElementById('ai-msg').textContent).toBe('<script>alert(4)</script>');

    OS.saveCurrentAsPreset();
    const presetOverlay = document.querySelector('.modal-overlay');
    expect(presetOverlay.querySelector('[onclick]')).toBeNull();
    expect(presetOverlay.textContent).toContain('Save Preset');
  });

  it('keeps the filter worker on named operations instead of string execution', async () => {
    const source = readFileSync('index.html', 'utf8');
    expect(source).not.toContain("'unsafe-eval'");
    expect(source).not.toContain('new Function');
    expect(source).not.toMatch(/_runFilterInWorker\s*\(\s*`/);
    expect(source).not.toMatch(/\bfn:`/);

    const OS = loadOpenShop();
    OS._photonFilterDisabled = true;
    OS._runFilterJob = vi.fn().mockResolvedValue('filtered');
    const imageData = new ImageData(new Uint8ClampedArray(4), 1, 1);

    await expect(OS._runFilterWithPhoton('threshold', imageData, 1, 1, { thr: 128 })).resolves.toBe('filtered');
    expect(OS._runFilterJob).toHaveBeenCalledWith(
      { backend: 'worker', op: 'threshold' },
      imageData,
      1,
      1,
      { thr: 128 }
    );
    expect(OS._getDirectPhotonFilter('Sharpen')).toEqual({ op: 'sharpen' });
    expect(OS._getDirectPhotonFilter('BlackWhite')).toEqual({ op: 'threshold', params: { thr: 128 } });
  });

  it('rejects tampered lazy runtime bytes and never retains the poisoned response', async () => {
    const OS = loadOpenShop();
    const trusted = new TextEncoder().encode('reviewed runtime bytes');
    const tampered = new TextEncoder().encode('tampered runtime bytes');
    const digest = await crypto.subtle.digest('SHA-384', trusted);
    const integrity = `sha384-${Buffer.from(digest).toString('base64')}`;
    let responseBytes = tampered;
    const fetchRuntime = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => responseBytes.buffer.slice(0)
    }));
    vi.stubGlobal('fetch', fetchRuntime);
    OS._runtimeAssets = {
      fixture: Object.freeze({
        url: 'https://cdn.jsdelivr.net/npm/example@1.0.0/runtime.js',
        integrity,
        type: 'application/javascript'
      })
    };
    OS._runtimeAssetPromises = new Map();

    await expect(OS._fetchVerifiedRuntimeAsset('fixture')).rejects.toThrow('integrity check failed');
    expect(OS._runtimeAssetPromises.has('fixture')).toBe(false);

    responseBytes = trusted;
    const verified = await OS._fetchVerifiedRuntimeAsset('fixture');
    expect(verified.bytes.byteLength).toBe(trusted.byteLength);
    expect(fetchRuntime).toHaveBeenCalledTimes(2);
    await expect(OS._fetchVerifiedRuntimeAsset('undeclared')).rejects.toThrow('Unknown runtime asset');
    vi.unstubAllGlobals();
  });

  it('converts a clicked segmentation result into a pixel selection mask', async () => {
    const OS = loadOpenShop();
    const target = {
      name: 'Subject Photo',
      type: 'image',
      width: 16,
      height: 16,
      scaleX: 1,
      scaleY: 1,
      originX: 'left',
      originY: 'top',
      visible: true,
      getElement: () => ({ naturalWidth: 16, naturalHeight: 16 }),
      calcTransformMatrix: () => [1, 0, 0, 1, 8, 8]
    };
    const canvas = createCanvasMock([target]);
    canvas.setActiveObject(target);
    OS.canvas = canvas;
    quietUiMethods(OS);
    OS._showAIProgress = vi.fn();
    OS._hideAIProgress = vi.fn();
    OS._showMaskOverlay = vi.fn();
    OS._imageToDataURL = vi.fn(() => 'data:image/png;base64,TEST');

    const makeMask = (predicate) => {
      const data = new Uint8Array(16 * 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (predicate(x, y)) data[y * 16 + x] = 255;
        }
      }
      return { width: 16, height: 16, channels: 1, data };
    };
    const results = [
      { label: 'left-object', score: 0.95, mask: makeMask((x, y) => x >= 1 && x <= 4 && y >= 4 && y <= 11) },
      { label: 'right-object', score: 0.9, mask: makeMask((x, y) => x >= 12 && x <= 15 && y >= 4 && y <= 11) }
    ];
    const segmenter = vi.fn().mockResolvedValue(results);
    OS._loadPipeline = vi.fn().mockResolvedValue(segmenter);

    await OS.aiSegmentSelectAt({ x: 14, y: 8 });

    expect(OS._loadPipeline).toHaveBeenCalledWith(
      'image-segmentation',
      'Xenova/detr-resnet-50-panoptic',
      'Segment Select',
      expect.objectContaining({ kind: 'Segment Select', generation: 0, revision: 0 })
    );
    expect(segmenter).toHaveBeenCalledWith('data:image/png;base64,TEST');
    expect(OS._selectionBounds).toEqual({ x: 13, y: 5, w: 4, h: 8 });
    expect(OS._selectionMask.mask.filter(Boolean)).toHaveLength(32);
    expect(OS._showMaskOverlay).toHaveBeenCalledWith(OS._selectionMask);
    expect(OS.toast).toHaveBeenCalledWith('Selected segment: right-object (32 px)', 'success');
  });

  it('cancels a filter job by rejecting its promise, terminating its worker, and preserving document state', async () => {
    const OS = loadOpenShop();
    const target = { name: 'Photo', type: 'image', visible: true };
    const canvas = createCanvasMock([target]);
    canvas.setActiveObject(target);
    OS.canvas = canvas;
    OS.layers = [{ name: 'Photo', visible: true, locked: false, objects: [target] }];
    quietUiMethods(OS);

    const listeners = {};
    const worker = {
      addEventListener: vi.fn((type, listener) => { listeners[type] = listener; }),
      postMessage: vi.fn(),
      terminate: vi.fn()
    };
    OS._getFilterWorker = vi.fn(() => worker);
    const source = new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1);
    const revision = OS._documentRevision;
    const historyLength = OS.history.length;
    const pending = OS._runFilterJob({ backend: 'worker', op: 'posterize' }, source, 1, 1, { levels: 4 });
    const rejected = pending.catch(error => error);

    expect(OS._activeProgressJobId).toBeTruthy();
    expect(document.getElementById('compute-actions').hidden).toBe(false);
    expect(OS.cancelActiveCompute()).toBe(true);

    const error = await rejected;
    expect(error.name).toBe('AbortError');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(OS._filterJobCallbacks).toEqual({});
    expect(OS._documentRevision).toBe(revision);
    expect(OS.history).toHaveLength(historyLength);
    expect(canvas.getObjects()).toEqual([target]);
    expect(OS._activeProgressJobId).toBeNull();
  });

  it('discards a late AI result after the document revision changes', async () => {
    const OS = loadOpenShop();
    const target = {
      name: 'Subject Photo',
      type: 'image',
      width: 16,
      height: 16,
      scaleX: 1,
      scaleY: 1,
      originX: 'left',
      originY: 'top',
      visible: true,
      getElement: () => ({ naturalWidth: 16, naturalHeight: 16 }),
      calcTransformMatrix: () => [1, 0, 0, 1, 8, 8]
    };
    const canvas = createCanvasMock([target]);
    canvas.setActiveObject(target);
    OS.canvas = canvas;
    OS.layers = [{ name: 'Photo', visible: true, locked: false, objects: [target] }];
    quietUiMethods(OS);
    OS._imageToDataURL = vi.fn(() => 'data:image/png;base64,TEST');

    let resolveInference;
    const inference = new Promise(resolve => { resolveInference = resolve; });
    const segmenter = vi.fn(() => inference);
    OS._loadPipeline = vi.fn().mockResolvedValue(segmenter);

    const pending = OS.aiSegmentSelectAt({ x: 8, y: 8 });
    await vi.waitFor(() => expect(segmenter).toHaveBeenCalled());
    OS._documentRevision += 1;
    resolveInference([{ label: 'subject', score: 1, mask: { width: 1, height: 1, channels: 1, data: new Uint8Array([255]) } }]);

    await expect(pending).resolves.toBe(false);
    expect(OS._selectionMask).toBeNull();
    expect(OS.history).toHaveLength(0);
    expect(canvas.getObjects()).toEqual([target]);
    expect(OS.toast).toHaveBeenCalledWith('Segment Select result discarded because the document changed', 'info');
  });

  it('prefers Photon filters and falls back to the JS worker after failure', async () => {
    const OS = loadOpenShop();
    const input = { data: new Uint8ClampedArray([10, 20, 30, 255]) };
    const photonResult = { data: new Uint8ClampedArray([255, 255, 255, 255]) };
    const fallbackResult = { data: new Uint8ClampedArray([0, 0, 0, 255]) };

    OS._runPhotonFilterInWorker = vi.fn().mockResolvedValueOnce(photonResult);
    OS._runFilterInWorker = vi.fn();

    await expect(OS._runFilterWithPhoton('edgeDetect', input, 1, 1)).resolves.toBe(photonResult);
    expect(OS._runPhotonFilterInWorker).toHaveBeenCalledWith('edgeDetect', input, 1, 1, undefined);
    expect(OS._runFilterInWorker).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    OS._runPhotonFilterInWorker = vi.fn().mockRejectedValueOnce(new Error('WASM blocked'));
    OS._runFilterInWorker = vi.fn().mockResolvedValueOnce(fallbackResult);

    await expect(OS._runFilterWithPhoton('threshold', input, 1, 1, { thr: 128 })).resolves.toBe(fallbackResult);
    expect(OS._photonFilterDisabled).toBe(true);
    expect(OS._runFilterInWorker).toHaveBeenCalledWith('threshold', input, 1, 1, { thr: 128 });
    warn.mockRestore();
  });

  it('routes one-click direct filters through the image-data backend', async () => {
    const OS = loadOpenShop();
    const active = { name: 'Photo', type: 'image' };
    const canvas = createCanvasMock([active]);
    canvas.setActiveObject(active);
    OS.canvas = canvas;
    quietUiMethods(OS);

    const input = { data: new Uint8ClampedArray([10, 20, 30, 255]), width: 1, height: 1 };
    const output = { data: new Uint8ClampedArray([30, 40, 50, 255]), width: 1, height: 1 };
    const info = { active, canvas: { width: 1, height: 1 }, imgData: input };
    OS._getActiveImageData = vi.fn(() => info);
    OS._runFilterWithPhoton = vi.fn().mockResolvedValue(output);
    OS._commitImageData = vi.fn();

    await OS.applyFilterDirect('Sharpen');

    expect(OS._runFilterWithPhoton).toHaveBeenCalledWith(
      'sharpen',
      input,
      1,
      1,
      {}
    );
    expect(OS._commitImageData).toHaveBeenCalledWith({...info, imgData: output}, 'Filter: Sharpen');
    expect(OS._lastFilter).toBe('Sharpen');
    expect(OS.toast).toHaveBeenCalledWith('Applied Sharpen', 'success');
  });

  it('bounds PSD headers, layer structure, transferred pixels, and aggregate decode memory', () => {
    const OS = loadOpenShop();
    const makeHeader = ({ width = 100, height = 80, channels = 4, depth = 8, colorMode = 3 } = {}) => {
      const bytes = new Uint8Array(26);
      bytes.set([0x38, 0x42, 0x50, 0x53], 0);
      const view = new DataView(bytes.buffer);
      view.setUint16(4, 1, false);
      view.setUint16(12, channels, false);
      view.setUint32(14, height, false);
      view.setUint32(18, width, false);
      view.setUint16(22, depth, false);
      view.setUint16(24, colorMode, false);
      return bytes;
    };
    expect(OS._readPSDHeader(makeHeader())).toMatchObject({ width: 100, height: 80, depth: 8, colorMode: 3 });
    expect(() => OS._validatePSDHeader(OS._readPSDHeader(makeHeader({ width: 90000 })), 1024)).toThrow(/dimensions exceed/);
    expect(() => OS._validatePSDHeader(OS._readPSDHeader(makeHeader({ depth: 32 })), 1024)).toThrow(/bit depth/);
    expect(() => OS._validatePSDHeader(OS._readPSDHeader(makeHeader({ colorMode: 4 })), 1024)).toThrow(/RGB/);
    expect(() => OS._validatePSDHeader(OS._readPSDHeader(makeHeader()), OS._psdLimits.maxFileBytes + 1)).toThrow(/256 MB/);
    expect(() => OS._validatePSDStructure({
      width: 100,
      height: 80,
      children: Array.from({ length: OS._psdLimits.maxLayers + 1 }, (_, i) => ({ name: `Layer ${i}` }))
    })).toThrow(/layers/);
    expect(() => OS._validatePSDStructure({
      width: 100,
      height: 80,
      children: [{ left: 0, top: 0, right: 100000, bottom: 2 }]
    })).toThrow(/layer 1 exceeds/);

    const validPixels = { width: 10, height: 10, buffer: new ArrayBuffer(10 * 10 * 4) };
    expect(() => OS._validatePSDDecodedPayload({
      width: 100,
      height: 80,
      decodedBytes: validPixels.buffer.byteLength,
      composite: validPixels,
      children: []
    })).not.toThrow();
    expect(() => OS._validatePSDDecodedPayload({
      width: 100,
      height: 80,
      decodedBytes: OS._psdLimits.maxDecodedBytes + 1,
      composite: null,
      children: []
    })).toThrow(/decoded memory/);
    expect(() => OS._validatePSDDecodedPayload({
      width: 100,
      height: 80,
      decodedBytes: 8,
      composite: { width: 2, height: 2, buffer: new ArrayBuffer(8) },
      children: []
    })).toThrow(/truncated/);
  });

  it('centralizes import schemas and resource budgets', () => {
    const OS = loadOpenShop();
    OS.toast = vi.fn();
    const image = { type: 'image/png', size: 1024, name: 'safe.png' };
    expect(() => OS._validateImageFile(image)).not.toThrow();
    expect(() => OS._validateImageFile({ type: 'text/html', size: 1 })).toThrow(/Unsupported image/);
    expect(() => OS._validateDecodedImage({ width: 40000, height: 10 })).toThrow(/dimensions exceed/);
    expect(() => OS._assertJsonFileBudget({ size: OS._importLimits.maxJsonBytes + 1 }, 'Project')).toThrow(/Project file exceeds/);

    const project = {
      _openShop: { w: '1200', h: '800' },
      objects: [{ id: '<bad>', name: 'javascript:alert(1) onerror=x' }]
    };
    OS._sanitizeProjectJSON(project);
    expect(project._openShop).toEqual({ w: 1200, h: 800 });
    expect(project.objects[0].id).toBe('bad');
    expect(project.objects[0].name).not.toContain('javascript:');

    expect(() => OS._sanitizeProjectJSON({ _openShop: { w: 100000, h: 100000 } })).toThrow(/Project dimensions/);
    expect(OS._sanitizePaletteColors(['#ABCDEF', 'javascript:alert(1)', '#112233']).map(c => c)).toEqual(['#abcdef', '#112233']);
    expect(OS._sanitizePresetList([
      { name: '<img src=x onerror=alert(1)>', adjustments: { brightness: '9999', contrast: 'bad' } },
      { name: '', adjustments: {} }
    ])).toEqual([
      { name: '<img src=x onerror=alert(1)>', adjustments: { brightness: 300, contrast: 0, saturation: 0, hue: 0, vibrance: 0 }, custom: false }
    ]);
  });

  it('shows recovery storage status and restores sanitized recovery data', async () => {
    const OS = loadOpenShop();
    const canvas = createCanvasMock();
    OS.canvas = canvas;
    quietUiMethods(OS);
    OS.rebuildLayersFromCanvas = vi.fn();
    OS.zoomFit = vi.fn();
    const recovery = JSON.stringify({ _openShop: { w: 640, h: 480 }, objects: [{ name: 'javascript:alert(1)' }] });
    OS._getRecoveryInfo = vi.fn().mockResolvedValue({
      supported: true,
      exists: true,
      corrupt: false,
      ageMs: 120000,
      size: recovery.length,
      usage: 2048,
      quota: 4096,
      text: recovery
    });

    await OS.showRecoveryManager();
    const modal = document.querySelector('.modal-overlay .modal');
    expect(modal.textContent).toContain('Recovery Storage');
    expect(modal.textContent).toContain('Available');
    expect(modal.textContent).toContain('2 min ago');
    expect(modal.querySelector('[onclick]')).toBeNull();

    modal.querySelector('.btn-primary').click();
    await vi.waitFor(() => expect(OS.toast).toHaveBeenCalledWith('Project restored from auto-save', 'success'));
    expect(canvas.loadFromJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        objects: [expect.objectContaining({ name: 'alert(1)' })]
      })
    );

    OS._getRecoveryInfo = vi.fn().mockResolvedValue({
      supported: true,
      exists: true,
      corrupt: true,
      error: '<img src=x onerror=alert(1)>',
      ageMs: 0,
      size: 4,
      usage: 4,
      quota: 10,
      text: '{bad'
    });
    await OS.showRecoveryManager();
    const corruptModal = document.querySelector('.modal-overlay .modal');
    expect(corruptModal.querySelector('img')).toBeNull();
    expect(corruptModal.textContent).toContain('Corrupt');
    expect(corruptModal.querySelector('.btn-primary').disabled).toBe(true);
  });

  it('retains bounded immutable recovery generations per document and globally', () => {
    const OS = loadOpenShop();
    OS._recoveryRetentionPerDocument = 3;
    OS._recoveryRetentionTotal = 5;
    const makeRecord = (documentId, index) => {
      const envelope = {
        generationId: `${documentId}-${index}`,
        documentId,
        ownerId: 'tab-a',
        leaseExpiresAt: 0,
        name: documentId,
        label: '',
        revision: index,
        createdAt: new Date(Date.UTC(2026, 6, 29, 12, 0, index)).toISOString(),
        checksumAlgorithm: 'sha256',
        checksum: String(index).padStart(64, '0')
      };
      return {
        filename: `recovery-${documentId}-${index}.json`,
        valid: true,
        legacy: false,
        envelope,
        size: 100 + index
      };
    };
    const records = [
      ...Array.from({ length: 4 }, (_, index) => makeRecord('doc-a', index)),
      ...Array.from({ length: 3 }, (_, index) => makeRecord('doc-b', index))
    ];
    const newEnvelope = makeRecord('doc-a', 5).envelope;
    const newest = OS._recoveryIndexEntry('recovery-doc-a-5.json', newEnvelope, 105);
    const retention = OS._selectRecoveryRetention(records, newest);

    expect(retention.kept).toHaveLength(5);
    expect(retention.kept.filter((entry) => entry.documentId === 'doc-a')).toHaveLength(3);
    expect(retention.kept.filter((entry) => entry.documentId === 'doc-b')).toHaveLength(2);
    expect(retention.kept[0].generationId).toBe('doc-a-5');
    expect(retention.pruned).toContain('recovery-doc-a-0.json');
  });

  it('preserves text newlines, long text, and base64 sources through sanitization', () => {
    const OS = loadOpenShop();
    const longText = `line one\nline two\tconversation=5\n${'x'.repeat(900)}`;
    // A base64 tail that the previous on\w+= scrub silently ate.
    const src = 'data:image/png;base64,AAAAoNCnowqRiJABapIV9aIw8g==';
    const project = {
      kind: 'openshop-document',
      schemaVersion: 1,
      canvas: { width: 800, height: 600, fabric: { objects: [] } },
      layers: [{ id: 'layer-1', objectIds: [] }],
      objects: [{ type: 'textbox', text: longText, src }]
    };

    OS._sanitizeProjectJSON(project);
    expect(project.objects[0].text).toBe(longText);
    expect(project.objects[0].src).toBe(src);

    // Trusted internal snapshots are validated but never rewritten.
    const trusted = { objects: [{ name: 'javascript:keep', text: longText, id: '<keep>' }] };
    OS._sanitizeProjectJSON(trusted, { trusted: true });
    expect(trusted.objects[0].name).toBe('javascript:keep');
    expect(trusted.objects[0].id).toBe('<keep>');
    expect(trusted.objects[0].text).toBe(longText);

    // Structural limits still apply in trusted mode.
    expect(() => OS._sanitizeProjectJSON(
      { objects: Array.from({ length: OS._importLimits.maxProjectObjects + 2 }, () => ({})) },
      { trusted: true }
    )).toThrow(/exceeds import limits/);
  });

  it('guards document-replacing actions when the document is dirty', async () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    quietUiMethods(OS);
    installModalDelegation();

    // A clean document never prompts.
    OS._isDirty = false;
    await expect(OS._confirmDiscardUnsaved()).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();

    OS._isDirty = true;
    const cancelled = OS._confirmDiscardUnsaved('Creating a new document');
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay.textContent).toMatch(/Discard unsaved changes\?/);
    expect([...overlay.querySelectorAll('button')].map((b) => b.textContent))
      .toEqual(['Cancel', 'Save first', 'Discard']);
    overlay.querySelector('[data-modal-cancel]').click();
    await expect(cancelled).resolves.toBe(false);
    expect(document.querySelector('.modal-overlay')).toBeNull();

    const discarded = OS._confirmDiscardUnsaved();
    const second = document.querySelector('.modal-overlay');
    [...second.querySelectorAll('button')].find((b) => b.textContent === 'Discard').click();
    await expect(discarded).resolves.toBe(true);

    // "Save first" only proceeds when the save actually succeeds.
    OS.saveProject = vi.fn().mockResolvedValue(false);
    const failed = OS._confirmDiscardUnsaved();
    const third = document.querySelector('.modal-overlay');
    [...third.querySelectorAll('button')].find((b) => b.textContent === 'Save first').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
    OS.saveProject = vi.fn().mockResolvedValue(true);
    [...document.querySelectorAll('.modal-overlay button')].find((b) => b.textContent === 'Save first').click();
    await expect(failed).resolves.toBe(true);
  });

  it('offers recovery above the welcome launcher', () => {
    const OS = loadOpenShop();
    quietUiMethods(OS);
    const overlay = OS._offerRecovery({
      valid: true,
      payloadText: '{}',
      name: 'Untitled',
      createdAt: new Date(0).toISOString()
    });
    // The welcome overlay is z-index 30000 and is still up during startup.
    expect(overlay.classList.contains('recovery-overlay')).toBe(true);
    overlay.remove();
  });

  it('hides selection overlays during raster capture and restores them after', () => {
    const OS = loadOpenShop();
    const boundary = { name: '__boundary__', visible: true, opacity: 1, set(key, value) { this[key] = value; } };
    const overlay = { name: 'wand', visible: true, excludeFromExport: true, _wandOverlay: true };
    const photo = { name: 'Photo', visible: true };
    OS.canvas = createCanvasMock([boundary, overlay, photo]);
    quietUiMethods(OS);
    OS._enforceLayerInvariants = vi.fn();

    let visibleDuringCapture = null;
    OS.canvas.toDataURL = vi.fn(() => {
      visibleDuringCapture = { overlay: overlay.visible, photo: photo.visible };
      return 'data:image/png;base64,AAAA';
    });

    OS._withExportCanvasState({ transparent: true }, () => OS.canvas.toDataURL({}));

    expect(visibleDuringCapture).toEqual({ overlay: false, photo: true });
    expect(overlay.visible).toBe(true);
  });

  it('never rolls back a transaction started by another command', async () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    quietUiMethods(OS);
    OS._captureDocumentState = vi.fn(() => ({ kind: 'openshop-document' }));
    OS._pushHistoryEntry = vi.fn(() => true);
    const rollback = vi.spyOn(OS, '_rollbackHistoryTransaction');

    let release;
    const slow = new Promise((resolve) => { release = resolve; });
    OS._getCommandRegistry = () => new Map([
      ['canvas.flatten', { execute: () => slow }]
    ]);
    OS._normalizeCommand = (command) => ({ id: command.id, schemaVersion: 1, args: {} });

    const first = OS._executeCommand({ id: 'canvas.flatten' });
    expect(OS._historyTransaction).not.toBeNull();
    const held = OS._historyTransaction;

    // Second command arrives while the first is still awaiting.
    const second = await OS._executeCommand({ id: 'canvas.flatten' });
    expect(second).toBe(false);
    expect(rollback).not.toHaveBeenCalled();
    expect(OS._historyTransaction).toBe(held);

    release(true);
    await expect(first).resolves.toBe(true);
  });

  it('keeps the document dirty when an edit lands during the autosave clear', async () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    quietUiMethods(OS);
    OS.layers = [{ name: 'Background', visible: true, opacity: 100, blend: 'source-over', objects: [] }];
    OS.canvasW = 800;
    OS.canvasH = 600;
    OS._isDirty = true;
    OS._documentRevision = 4;
    // The edit arrives while the recovery lock is held.
    OS._clearAutoSave = vi.fn(async () => { OS._documentRevision += 1; });
    OS._writeProjectFile = vi.fn().mockResolvedValue(true);
    const toasts = [];
    OS.toast = (message, type) => toasts.push({ message, type });

    await OS._saveProjectTransaction();

    expect(OS._isDirty).toBe(true);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._persistenceState).toBe('dirty');
    expect(toasts.some((entry) => /newer edits remain unsaved/.test(entry.message))).toBe(true);
  });

  it('sanitizes a large hostile string without quadratic backtracking', () => {
    const OS = loadOpenShop();
    const payload = { objects: [{ name: 'on'.repeat(500000) }] };
    const started = Date.now();
    OS._sanitizeProjectJSON(payload);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('round-trips project save and open with sanitization', async () => {
    const OS = loadOpenShop();
    const boundary = { name: '__boundary__', type: 'rect', visible: true };
    const photo = { name: 'Photo', type: 'image', visible: true, opacity: 1 };
    const canvas = createCanvasMock([boundary, photo]);
    canvas.toJSON = vi.fn(() => ({
      objects: [
        { name: '__boundary__', type: 'rect' },
        { name: 'Photo', type: 'image' }
      ]
    }));
    OS.canvas = canvas;
    OS.layers = [{ name: 'Background', visible: true, opacity: 100, blend: 'source-over', objects: [boundary, photo] }];
    OS.canvasW = 800;
    OS.canvasH = 600;
    quietUiMethods(OS);
    OS.rebuildLayersFromCanvas = vi.fn();
    OS.zoomFit = vi.fn();
    OS.saveHistory = vi.fn();
    OS._clearAutoSave = vi.fn();

    const state = OS._captureDocumentState();
    expect(state.kind).toBe('openshop-document');
    expect(state.schemaVersion).toBe(1);
    expect(state.canvas.width).toBe(800);
    expect(state.canvas.height).toBe(600);
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0].objectIds).toHaveLength(2);

    const clicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicks.push({ download: this.download });
    });
    await OS.saveProject();
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('openshop-project.openshop');

    const hostile = {
      _openShop: { w: '640', h: '480' },
      objects: [{ name: '<script>alert(1)</script>', src: 'data:image/png;base64,AAAA' }]
    };
    OS._sanitizeProjectJSON(hostile);
    expect(hostile._openShop.w).toBe(640);
    expect(hostile.objects[0].name).not.toContain('onerror=');

    for (const src of ['javascript:alert(2)', 'https://tracker.example/beacon.png', 'http://10.0.0.1/x.png']) {
      expect(() => OS._sanitizeProjectJSON({
        _openShop: { w: '640', h: '480' },
        objects: [{ src }]
      })).toThrow(/non-embedded asset URL/);
    }
  });

  it('registers one installed-app launch consumer and routes supported files', async () => {
    const OS = loadOpenShop();
    quietUiMethods(OS);
    OS.dismissWelcome = vi.fn();
    OS._loadPSDFile = vi.fn().mockResolvedValue(true);
    OS._loadProjectFile = vi.fn().mockResolvedValue(true);
    OS._handleFileLoad = vi.fn();

    let consumer;
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: vi.fn((callback) => { consumer = callback; })
      }
    });

    expect(OS._initFileLaunchQueue()).toBe(true);
    expect(window.launchQueue.setConsumer).toHaveBeenCalledTimes(1);

    const psd = { name: 'layers.psd', type: 'image/vnd.adobe.photoshop' };
    await consumer({ files: [{ getFile: vi.fn().mockResolvedValue(psd) }] });
    expect(OS._loadPSDFile).toHaveBeenCalledWith(psd);

    const project = { name: 'layout.openshop', type: 'application/vnd.openshop+json' };
    const projectHandle = { getFile: vi.fn().mockResolvedValue(project) };
    await OS._handleLaunchedFile(projectHandle);
    expect(OS._loadProjectFile).toHaveBeenCalledWith(project, { handle: projectHandle });

    const image = { name: 'photo.png', type: 'image/png' };
    await OS._handleLaunchedFile({ getFile: vi.fn().mockResolvedValue(image) });
    expect(OS._handleFileLoad).toHaveBeenCalledWith(image);
    expect(OS.dismissWelcome).toHaveBeenCalledTimes(3);

    const unsupported = await OS._handleLaunchedFile({
      getFile: vi.fn().mockResolvedValue({ name: 'notes.txt', type: 'text/plain' })
    });
    expect(unsupported).toBe(false);
    expect(OS.toast).toHaveBeenCalledWith('Could not open launched file: Unsupported launched file type', 'error');
    delete window.launchQueue;
  });

  it('clears dirty and recovery state only after an acknowledged project write', async () => {
    const OS = loadOpenShop();
    const object = { name: 'Subject', type: 'rect' };
    OS.canvas = createCanvasMock([object]);
    OS.layers = [{ name: 'Subject', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [object] }];
    quietUiMethods(OS);
    OS._clearAutoSave = vi.fn().mockResolvedValue(true);
    OS.saveHistory('Edit subject');

    let finishClose;
    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(() => new Promise((resolve) => { finishClose = resolve; })),
      abort: vi.fn()
    };
    OS._projectFileHandle = { createWritable: vi.fn().mockResolvedValue(writable) };

    const pending = OS.saveProject();
    await vi.waitFor(() => expect(writable.close).toHaveBeenCalled());
    expect(OS._isDirty).toBe(true);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._clearAutoSave).not.toHaveBeenCalled();
    expect(document.getElementById('persistence-state-label').textContent).toBe('Saving');

    finishClose();
    await expect(pending).resolves.toBe(true);

    expect(writable.write).toHaveBeenCalledWith(expect.stringContaining('"kind":"openshop-document"'));
    expect(OS._clearAutoSave).toHaveBeenCalledTimes(1);
    expect(OS._isDirty).toBe(false);
    expect(OS._autoSaveDirty).toBe(false);
    expect(OS._persistenceState).toBe('saved');
    expect(document.getElementById('persistence-state-label').textContent).toBe('Saved');
    expect(document.title).not.toMatch(/^\*/);
  });

  it('preserves dirty recovery state when a project write fails or is cancelled', async () => {
    const OS = loadOpenShop();
    const object = { name: 'Subject', type: 'rect' };
    OS.canvas = createCanvasMock([object]);
    OS.layers = [{ name: 'Subject', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [object] }];
    quietUiMethods(OS);
    OS._clearAutoSave = vi.fn().mockResolvedValue(true);
    OS.saveHistory('Edit subject');

    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockRejectedValue(new Error('Disk full')),
      abort: vi.fn().mockResolvedValue(undefined)
    };
    OS._projectFileHandle = { createWritable: vi.fn().mockResolvedValue(writable) };

    await expect(OS.saveProject()).resolves.toBe(false);
    expect(writable.abort).toHaveBeenCalled();
    expect(OS._projectFileHandle).toBeNull();
    expect(OS._clearAutoSave).not.toHaveBeenCalled();
    expect(OS._isDirty).toBe(true);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._persistenceState).toBe('error');
    expect(OS.toast).toHaveBeenCalledWith('Project save failed: Disk full', 'error');

    const cancelled = Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    window.showSaveFilePicker = vi.fn().mockRejectedValue(cancelled);
    await expect(OS.saveProject()).resolves.toBe(false);
    expect(OS._isDirty).toBe(true);
    expect(OS._persistenceState).toBe('dirty');
    expect(OS._clearAutoSave).not.toHaveBeenCalled();
  });

  it('keeps edits made during a project write dirty after the older snapshot commits', async () => {
    const OS = loadOpenShop();
    const object = { name: 'Subject', type: 'rect' };
    OS.canvas = createCanvasMock([object]);
    OS.layers = [{ name: 'Subject', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [object] }];
    quietUiMethods(OS);
    OS._clearAutoSave = vi.fn().mockResolvedValue(true);
    OS.saveHistory('First edit');

    let finishClose;
    const close = vi.fn(() => new Promise((resolve) => { finishClose = resolve; }));
    OS._projectFileHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close,
        abort: vi.fn()
      })
    };

    const pending = OS.saveProject();
    await vi.waitFor(() => expect(close).toHaveBeenCalled());
    object.name = 'Newer Subject';
    OS.saveHistory('Newer edit');
    finishClose();
    await expect(pending).resolves.toBe(true);

    expect(OS._isDirty).toBe(true);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._persistenceState).toBe('dirty');
    expect(OS._clearAutoSave).not.toHaveBeenCalled();
    expect(OS.toast).toHaveBeenCalledWith('Saved snapshot; newer edits remain unsaved', 'info');
  });

  it('waits for the worker acknowledgement before clearing autosave work', async () => {
    const OS = loadOpenShop();
    const object = { name: 'Subject', type: 'rect' };
    OS.canvas = createCanvasMock([object]);
    OS.layers = [{ name: 'Subject', visible: true, locked: false, opacity: 100, blend: 'source-over', objects: [object] }];
    quietUiMethods(OS);
    OS.saveHistory('Autosave edit');

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        getDirectory: vi.fn().mockResolvedValue({
          getFileHandle: vi.fn().mockRejectedValue(new Error('Main-thread writable unavailable'))
        })
      }
    });
    let acknowledge;
    OS._writeAutoSaveWithWorker = vi.fn(() => new Promise((resolve) => { acknowledge = resolve; }));

    const pending = OS._autoSave();
    await vi.waitFor(() => expect(OS._writeAutoSaveWithWorker).toHaveBeenCalled());
    expect(OS._persistenceState).toBe('saving');
    expect(OS._autoSaveDirty).toBe(true);

    acknowledge(true);
    await expect(pending).resolves.toBe(true);
    expect(OS._autoSaveDirty).toBe(false);
    expect(OS._isDirty).toBe(true);
    expect(OS._persistenceState).toBe('dirty');

    OS._markDocumentDirty();
    OS._writeAutoSaveWithWorker = vi.fn().mockRejectedValue(new Error('Worker write failed'));
    await expect(OS._autoSave()).resolves.toBe(false);
    expect(OS._autoSaveDirty).toBe(true);
    expect(OS._isDirty).toBe(true);
    expect(OS._persistenceState).toBe('error');
  });

  it('offers recovery with event-delegated buttons and restores or discards', async () => {
    const OS = loadOpenShop();
    const canvas = createCanvasMock();
    OS.canvas = canvas;
    quietUiMethods(OS);
    OS.rebuildLayersFromCanvas = vi.fn();
    OS.zoomFit = vi.fn();
    OS.saveHistory = vi.fn();
    OS._clearAutoSave = vi.fn();

    const project = JSON.stringify({ _openShop: { w: 320, h: 240 }, objects: [] });
    OS._offerRecovery(project);

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('[onclick]')).toBeNull();
    expect(overlay.textContent).toContain('Recover Unsaved Work');

    overlay.querySelector('[data-recovery-restore]').click();
    await vi.waitFor(() => expect(OS.toast).toHaveBeenCalledWith('Project restored from auto-save', 'success'));
    expect(canvas.loadFromJSON).toHaveBeenCalled();

    OS._offerRecovery(project);
    const overlay2 = document.querySelector('.modal-overlay');
    OS._discardRecovery = vi.fn();
    overlay2.querySelector('[data-recovery-discard]').click();
    expect(OS._discardRecovery).toHaveBeenCalled();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('sanitizes SVG export by stripping scripts and event handlers', () => {
    const OS = loadOpenShop();

    const malicious = `<svg xmlns="http://www.w3.org/2000/svg">
      <script>alert(1)</script>
      <rect width="100" height="100" onclick="alert(2)"/>
      <circle cx="50" cy="50" r="25" onload="alert(3)"/>
      <a href="javascript:alert(4)"><text>Click</text></a>
      <a href="data:text/html,test"><text>Link</text></a>
      <rect width="50" height="50" fill="blue"/>
    </svg>`;

    const clean = OS._sanitizeSVG(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('data:text/html');
    expect(clean).toContain('fill="blue"');
  });

  it('builds PSD export structure with correct layer metadata', () => {
    const OS = loadOpenShop();
    const boundary = {
      name: '__boundary__',
      visible: true,
      toCanvasElement: vi.fn(() => document.createElement('canvas')),
      left: 0,
      top: 0,
      opacity: 1,
      set(property, value) {
        this[property] = value;
      }
    };
    const photo = { name: 'Portrait', visible: true, toCanvasElement: vi.fn(() => document.createElement('canvas')), left: 10, top: 20, opacity: 0.8 };
    const canvas = createCanvasMock([boundary, photo]);
    OS.canvas = canvas;
    OS.canvasW = 400;
    OS.canvasH = 300;
    OS.layers = [
      { name: 'BG', visible: true, opacity: 100, blend: 'source-over', objects: [boundary] },
      {
        name: 'Subject',
        visible: true,
        opacity: 80,
        blend: 'multiply',
        psd: {
          sourceId: 'psd-0-0',
          parentId: 'psd-0',
          order: 0,
          sourceKind: 'bitmap',
          originalBlendMode: 'multiply',
          importedCanvasBlend: 'multiply'
        },
        objects: [photo]
      }
    ];
    OS._psdInterchange = {
      schemaVersion: 1,
      groups: [{
        id: 'psd-0',
        parentId: null,
        order: 0,
        name: 'Portraits',
        hidden: false,
        opacity: 0.75,
        blendMode: 'pass through',
        opened: false
      }],
      warnings: []
    };
    quietUiMethods(OS);

    let writtenPsd = null;
    const mockLib = {
      writePsd: vi.fn(psd => { writtenPsd = psd; return new Uint8Array([0x38, 0x42, 0x50, 0x53]); })
    };
    globalThis.agPsd = mockLib;

    const clicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicks.push({ download: this.download });
    });

    OS.exportPSD();

    expect(mockLib.writePsd).toHaveBeenCalled();
    expect(writtenPsd.width).toBe(400);
    expect(writtenPsd.height).toBe(300);
    expect(writtenPsd.children).toHaveLength(1);
    expect(writtenPsd.children[0]).toEqual(expect.objectContaining({
      name: 'Portraits',
      opacity: 0.75,
      blendMode: 'pass through',
      opened: false
    }));
    expect(writtenPsd.children[0].children).toHaveLength(1);
    expect(writtenPsd.children[0].children[0]).toEqual(expect.objectContaining({
      name: 'Subject',
      opacity: 0.8,
      blendMode: 'multiply'
    }));
    expect(clicks[0].download).toBe('openshop-export.psd');

    delete globalThis.agPsd;
  });

  it('chooses one explicit PSD composite fallback for unsupported document-wide semantics', () => {
    const OS = loadOpenShop();
    const report = OS._analyzePSDImport({
      width: 100,
      height: 80,
      composite: { width: 100, height: 80, buffer: new ArrayBuffer(100 * 80 * 4) },
      children: [{
        id: 'psd-0',
        sourceKind: 'bitmap',
        name: 'Clipped glow',
        blendMode: 'normal',
        opacity: 1,
        unsupported: ['clipping', 'layer effects'],
        children: []
      }]
    });

    expect(report.flattenWholeDocument).toBe(true);
    expect(report.warnings[0]).toMatch(/one flattened appearance layer instead of duplicating the composite/);
    expect(report.warnings.join(' ')).toMatch(/clipping relationships are not supported/);
    expect(report.warnings.join(' ')).toMatch(/layer effects are not editable/);
  });

  it('wires modal close and action buttons via data attributes', () => {
    const OS = loadOpenShop();
    OS.canvas = createCanvasMock();
    quietUiMethods(OS);
    OS.saveHistory = vi.fn();
    OS._clearAutoSave = vi.fn();
    OS.rebuildLayersFromCanvas = vi.fn();
    OS.zoomFit = vi.fn();

    OS.newImage();
    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('[onclick]')).toBeNull();

    const presets = overlay.querySelectorAll('[data-pw]');
    expect(presets.length).toBeGreaterThanOrEqual(4);
    presets[0].click();
    expect(overlay.querySelector('#ni-w').value).toBe(presets[0].dataset.pw);
    expect(overlay.querySelector('#ni-h').value).toBe(presets[0].dataset.ph);

    overlay.querySelector('[data-modal-close]').click();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
