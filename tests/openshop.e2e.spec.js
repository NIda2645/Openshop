import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const appUrl = pathToFileURL(join(process.cwd(), 'index.html')).toString();

test('loads the editor shell and supports core UI interactions', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mouseenter'));
    document.dispatchEvent(new MouseEvent('click'));
  });
  await expect(page.locator('#editor-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Enter Studio' }).click();
  await expect(page.locator('#welcome-overlay')).toHaveClass(/hidden/);
  await expect(page.locator('.tool-btn[data-tool="select"]').first()).toHaveClass(/active/);

  const brushTool = page.locator('.tool-btn[data-tool="brush"]').first();
  await brushTool.click();
  await brushTool.click();
  await expect(brushTool).toHaveClass(/active/);

  const layerItems = page.locator('#layers-list .layer-item');
  const layerCount = await layerItems.count();
  await page.locator('button[title="New Layer"]').click();
  await expect(layerItems).toHaveCount(layerCount + 1);

  await page.keyboard.press('Control+Z');
  await expect(page.locator('#history-list .history-item.current')).toContainText(/New Document|New Layer/);

  await expect(page).toHaveScreenshot('openshop-editor-shell.png', {
    animations: 'disabled',
    fullPage: false,
    maxDiffPixelRatio: 0.03
  });
  expect(pageErrors).toEqual([]);
});

test('exposes clean, dirty, saving, and saved project states', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const unloadPrevented = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

  await expect(page.locator('#persistence-state')).toHaveAttribute('data-state', 'clean');
  await expect(page.locator('#persistence-state-label')).toHaveText('All changes saved');
  expect(await unloadPrevented()).toBe(false);

  await page.locator('button[title="New Layer"]').click();
  await expect(page.locator('#persistence-state')).toHaveAttribute('data-state', 'dirty');
  await expect(page.locator('#persistence-state-label')).toHaveText('Unsaved changes');
  await expect(page).toHaveTitle(/^\* /);
  expect(await unloadPrevented()).toBe(true);

  await page.evaluate(() => {
    window.showSaveFilePicker = undefined;
    OS._clearAutoSave = () => new Promise((resolve) => { window.__finishRecoveryClear = resolve; });
  });
  const downloadPromise = page.waitForEvent('download');
  const savePromise = page.evaluate(() => OS.saveProject());
  await expect(page.locator('#persistence-state')).toHaveAttribute('data-state', 'saving');
  await downloadPromise;
  await page.evaluate(() => window.__finishRecoveryClear(true));
  await expect(savePromise).resolves.toBe(true);

  await expect(page.locator('#persistence-state')).toHaveAttribute('data-state', 'saved');
  await expect(page.locator('#persistence-state-label')).toHaveText('All changes saved');
  await expect(page).not.toHaveTitle(/^\* /);
  expect(await unloadPrevented()).toBe(false);
});

test('applies a one-click pixel filter to an active image layer', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    const source = document.createElement('canvas');
    source.width = 8;
    source.height = 8;
    const ctx = source.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 8, 8);
    gradient.addColorStop(0, '#203040');
    gradient.addColorStop(1, '#d8e8f8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 8);

    await new Promise((resolve) => {
      fabric.Image.fromURL(source.toDataURL('image/png'), (img) => {
        img.set({ name: 'Filter Smoke', left: 20, top: 20, selectable: true });
        OS.canvas.add(img);
        if (!OS.layers.length) OS.addLayer();
        OS.layers[OS.activeLayerIdx].objects.push(img);
        OS.canvas.setActiveObject(img);
        OS.canvas.renderAll();
        resolve();
      });
    });

    await OS.applyFilterDirect('Sharpen');

    await new Promise((resolve, reject) => {
      const started = performance.now();
      const poll = () => {
        const latest = OS.history[OS.history.length - 1]?.action;
        if (latest === 'Filter: Sharpen') {
          resolve();
          return;
        }
        if (performance.now() - started > 10000) {
          reject(new Error(`Timed out waiting for filter history, latest=${latest}`));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
    });

    return {
      activeName: OS.canvas.getActiveObject()?.name,
      historyAction: OS.history[OS.history.length - 1]?.action,
      photonDisabled: OS._photonFilterDisabled
    };
  });

  expect(result.historyAction).toBe('Filter: Sharpen');
  // The history entry carries the label; the object keeps its own identity.
  expect(result.activeName).toBe('Filter Smoke');
  expect(result.photonDisabled).toBe(false);
});

test('cancels a running pixel filter without changing pixels or history', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const before = await page.evaluate(async () => {
    const source = document.createElement('canvas');
    source.width = 8;
    source.height = 8;
    source.getContext('2d').fillRect(0, 0, 8, 8);
    const img = await fabric.Image.fromURL(source.toDataURL('image/png'));
    img.set({ name: 'Cancelable Filter', left: 20, top: 20, selectable: true });
    OS.canvas.add(img);
    OS.layers[OS.activeLayerIdx].objects.push(img);
    OS.canvas.setActiveObject(img);
    OS.canvas.renderAll();

    const listeners = {};
    const worker = {
      terminated: false,
      addEventListener(type, listener) { listeners[type] = listener; },
      postMessage() {},
      terminate() { this.terminated = true; }
    };
    OS._photonFilterDisabled = true;
    OS._getFilterWorker = () => worker;
    window.__cancelWorker = worker;
    window.__cancelFilterPromise = OS.applyFilterDirect('Sharpen');
    return {
      revision: OS._documentRevision,
      history: OS.history.map((entry) => entry.action),
      objectNames: OS.canvas.getObjects().map((object) => object.name)
    };
  });

  await expect(page.locator('#compute-cancel')).toBeVisible();
  await page.locator('#compute-cancel').click();

  const after = await page.evaluate(async () => {
    await window.__cancelFilterPromise;
    return {
      revision: OS._documentRevision,
      history: OS.history.map((entry) => entry.action),
      objectNames: OS.canvas.getObjects().map((object) => object.name),
      workerTerminated: window.__cancelWorker.terminated,
      callbacks: Object.keys(OS._filterJobCallbacks).length,
      progressVisible: document.getElementById('ai-progress').classList.contains('visible')
    };
  });

  expect(after).toMatchObject({
    revision: before.revision,
    history: before.history,
    objectNames: before.objectNames,
    workerTerminated: true,
    callbacks: 0,
    progressVisible: false
  });
  expect(pageErrors).toEqual([]);
});

test('creates a pixel selection from a mocked AI segment mask', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    OS.activateSegmentSelect();
    const source = document.createElement('canvas');
    source.width = 16;
    source.height = 16;
    const ctx = source.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(12, 4, 4, 8);

    await new Promise((resolve) => {
      fabric.Image.fromURL(source.toDataURL('image/png'), (img) => {
        img.set({ name: 'Segment Smoke', left: 0, top: 0, selectable: true });
        OS.canvas.add(img);
        OS.layers[OS.activeLayerIdx].objects.push(img);
        OS.canvas.setActiveObject(img);
        OS.canvas.renderAll();
        resolve();
      });
    });

    const data = new Uint8Array(16 * 16);
    for (let y = 4; y <= 11; y++) {
      for (let x = 12; x <= 15; x++) data[y * 16 + x] = 255;
    }
    OS._loadPipeline = async () => async () => [
      { label: 'bright-block', score: 0.99, mask: { width: 16, height: 16, channels: 1, data } }
    ];

    await OS.aiSegmentSelectAt({ x: 14, y: 8 });

    return {
      tool: OS.state.tool,
      optionVisible: document.getElementById('opt-ai-segment').style.display,
      bounds: OS._selectionBounds,
      count: OS._selectionMask ? OS._selectionMask.mask.filter(Boolean).length : 0,
      activeName: OS.canvas.getActiveObject()?.name
    };
  });

  expect(result.tool).toBe('ai-segment');
  expect(result.optionVisible).toBe('flex');
  expect(result.activeName).toBe('Segment Smoke');
  expect(result.count).toBeGreaterThan(0);
  expect(result.bounds.w).toBeGreaterThan(0);
  expect(result.bounds.h).toBeGreaterThan(0);
});

test('loads legacy Fabric 5 documents without geometry or metadata drift', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const legacyDocument = {
      version: '5.3.1',
      _openShop: {
        version: '0.18.13',
        w: 320,
        h: 200,
        activeLayerIdx: 2,
        layers: [
          { name: 'Legacy rectangle', visible: true, locked: false, opacity: 100, blend: 'source-over' },
          { name: 'Legacy text', visible: true, locked: false, opacity: 100, blend: 'source-over' },
          { name: 'Legacy group', visible: true, locked: false, opacity: 100, blend: 'source-over' }
        ]
      },
      objects: [
        {
          type: 'rect',
          version: '5.3.1',
          originX: 'left',
          originY: 'top',
          left: 17,
          top: 23,
          width: 80,
          height: 40,
          fill: '#336699',
          name: 'Legacy rectangle'
        },
        {
          type: 'i-text',
          version: '5.3.1',
          originX: 'left',
          originY: 'top',
          left: 41,
          top: 79,
          text: 'Legacy text',
          fontSize: 24,
          fill: '#ffffff',
          name: 'Legacy text'
        },
        {
          type: 'group',
          version: '5.3.1',
          originX: 'left',
          originY: 'top',
          left: 140,
          top: 90,
          width: 24,
          height: 24,
          name: 'Legacy group',
          objects: [{
            type: 'circle',
            version: '5.3.1',
            originX: 'left',
            originY: 'top',
            left: -12,
            top: -12,
            radius: 12,
            fill: '#cc3344'
          }]
        }
      ]
    };

    const migrated = await OS._loadDocumentState(legacyDocument);
    const objects = OS.canvas.getObjects();
    const cloneName = await new Promise((resolve, reject) => {
      objects[0].clone((clone) => resolve(clone.name)).catch(reject);
    });
    const serialized = OS.canvas.toJSON(['name']);

    return {
      version: fabric.version,
      migratedFrom: migrated.migratedFrom,
      cloneName,
      objects: objects.map((object) => ({
        type: object.type,
        name: object.name,
        left: object.left,
        top: object.top,
        originX: object.originX,
        originY: object.originY,
        text: object.text,
        children: object.getObjects?.().length || 0
      })),
      serializedNames: serialized.objects.map((object) => object.name),
      layers: OS.layers.map((layer) => ({
        name: layer.name,
        objects: layer.objects.map((object) => object.name)
      })),
      activeLayer: OS.layers[OS.activeLayerIdx].name
    };
  });

  expect(result.version).toBe('7.4.0');
  expect(result.migratedFrom).toBe('0.18.13');
  expect(result.cloneName).toBe('Legacy rectangle');
  expect(result.objects).toEqual([
    expect.objectContaining({ type: 'rect', name: 'Legacy rectangle', left: 17, top: 23, originX: 'left', originY: 'top' }),
    expect.objectContaining({ type: 'i-text', name: 'Legacy text', left: 41, top: 79, text: 'Legacy text' }),
    expect.objectContaining({ type: 'group', name: 'Legacy group', left: 140, top: 90, children: 1 })
  ]);
  expect(result.serializedNames).toEqual(['Legacy rectangle', 'Legacy text', 'Legacy group']);
  expect(result.layers).toEqual([
    { name: 'Legacy rectangle', objects: ['Legacy rectangle'] },
    { name: 'Legacy text', objects: ['Legacy text'] },
    { name: 'Legacy group', objects: ['Legacy group'] }
  ]);
  expect(result.activeLayer).toBe('Legacy group');
  expect(pageErrors).toEqual([]);
});

test('keeps hostile Fabric object ids and gradient colors inert in SVG export', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(() => {
    const payload = 'red"><img src="x" onerror="window.__fabricGradientXss=1">';
    const canvas = new fabric.StaticCanvas(null, { width: 32, height: 32 });
    const rect = new fabric.Rect({
      width: 20,
      height: 20,
      id: 'shape"><img src="x" onerror="window.__fabricIdXss=1">',
      fill: new fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: 20, y2: 0 },
        colorStops: [
          { offset: 0, color: payload },
          { offset: 1, color: '#336699' }
        ]
      })
    });
    canvas.add(rect);

    const cleanSvg = OS._sanitizeSVG(canvas.toSVG());
    const parsed = new DOMParser().parseFromString(cleanSvg, 'image/svg+xml');
    const elements = [...parsed.querySelectorAll('*')];
    const eventAttributes = elements.flatMap((element) =>
      [...element.attributes].filter((attribute) => attribute.name.toLowerCase().startsWith('on'))
    );
    const unsafeLinks = elements.some((element) => {
      const href = element.getAttribute('href') || element.getAttribute('xlink:href') || '';
      return /^(javascript:|data:text\/html)/i.test(href);
    });

    return {
      fabricVersion: fabric.version,
      parserErrors: parsed.querySelectorAll('parsererror').length,
      executableNodes: parsed.querySelectorAll('script, foreignObject, img').length,
      eventAttributes: eventAttributes.length,
      unsafeLinks,
      injectedFlags: Boolean(window.__fabricGradientXss || window.__fabricIdXss)
    };
  });

  expect(result).toEqual({
    fabricVersion: '7.4.0',
    parserErrors: 0,
    executableNodes: 0,
    eventAttributes: 0,
    unsafeLinks: false,
    injectedFlags: false
  });
});

test('decodes and bounds PSD pixels in a worker before committing the document', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    const makeCanvas = (color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 6;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
    };
    const bytes = agPsd.writePsd({
      width: 8,
      height: 6,
      canvas: makeCanvas('#cc2233'),
      children: [{
        name: 'Blue worker layer',
        left: 0,
        top: 0,
        right: 8,
        bottom: 6,
        canvas: makeCanvas('#2244cc')
      }]
    });
    const file = new File([bytes], 'worker-fixture.psd', { type: 'image/vnd.adobe.photoshop' });

    let workerCalls = 0;
    let mainThreadReadCalls = 0;
    let heartbeats = 0;
    const decode = OS._decodePSDInWorker.bind(OS);
    OS._decodePSDInWorker = (...args) => {
      workerCalls++;
      return decode(...args);
    };
    const mainRead = agPsd.readPsd;
    agPsd.readPsd = (...args) => {
      mainThreadReadCalls++;
      return mainRead(...args);
    };
    const heartbeat = setInterval(() => { heartbeats++; }, 0);
    const imported = await OS._loadPSDFile(file);
    clearInterval(heartbeat);
    agPsd.readPsd = mainRead;

    const layerImage = OS.layers.find((layer) => layer.name === 'Blue worker layer')?.objects[0];
    const pixel = layerImage?.getElement()?.getContext('2d')?.getImageData(0, 0, 1, 1).data;
    return {
      imported,
      workerCalls,
      mainThreadReadCalls,
      heartbeats,
      dimensions: [OS.canvasW, OS.canvasH],
      layers: OS.layers.map((layer) => layer.name),
      bluePixel: pixel ? [...pixel] : null,
      decodedLimit: OS._psdLimits.maxDecodedBytes,
      progressClosed: !document.getElementById('psd-import-progress'),
      dirty: OS._isDirty
    };
  });

  expect(result).toEqual(expect.objectContaining({
    imported: true,
    workerCalls: 1,
    mainThreadReadCalls: 0,
    dimensions: [8, 6],
    layers: ['Background', 'Blue worker layer'],
    progressClosed: true,
    dirty: true
  }));
  expect(result.heartbeats).toBeGreaterThan(0);
  expect(result.bluePixel[2]).toBeGreaterThan(result.bluePixel[0]);
  expect(result.decodedLimit).toBe(256 * 1024 * 1024);
  expect(pageErrors).toEqual([]);
});

test('round-trips nested PSD groups, blends, opacity, and basic text without duplicating the composite', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    const makeCanvas = (color, width = 16, height = 12) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      return canvas;
    };
    const sourceBytes = agPsd.writePsd({
      width: 16,
      height: 12,
      canvas: makeCanvas('#ee3344'),
      children: [{
        name: 'Outer',
        opacity: 0.75,
        blendMode: 'pass through',
        opened: false,
        children: [{
          name: 'Inner',
          blendMode: 'pass through',
          children: [{
            name: 'Blue',
            opacity: 0.5,
            blendMode: 'multiply',
            canvas: makeCanvas('#2244cc')
          }, {
            name: 'Caption',
            opacity: 0.6,
            blendMode: 'screen',
            canvas: makeCanvas('#222222'),
            text: {
              text: 'Hello',
              transform: [1, 0, 0, 1, 3, 4],
              style: {
                font: { name: 'Arial' },
                fontSize: 5,
                fillColor: { r: 255, g: 255, b: 255 }
              }
            }
          }]
        }]
      }]
    }, { trimImageData: true, noBackground: true });

    const summarizeDocument = () => ({
      layers: OS.layers.map((layer) => ({
        name: layer.name,
        opacity: layer.opacity,
        blend: layer.blend,
        type: layer.objects[0]?.type || null,
        text: layer.objects[0]?.text || null,
        parentId: layer.psd?.parentId || null,
        effectiveOpacity: layer.objects[0]?.opacity ?? null
      })),
      groups: OS._psdInterchange?.groups.map((group) => ({
        name: group.name,
        parentId: group.parentId,
        opacity: group.opacity,
        blendMode: group.blendMode,
        opened: group.opened
      })) || [],
      compositeLayerCount: OS.layers.filter((layer) => /Composite/.test(layer.name)).length
    });

    const firstImport = await OS._loadPSDFile(new File(
      [sourceBytes],
      'nested.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const first = summarizeDocument();
    const importWarning = document.querySelector('.psd-compat-report')?.innerText || '';
    document.querySelector('.psd-compat-report')?.remove();

    const built = OS._buildPsdExportStructure();
    const exportedBytes = agPsd.writePsd(built.structure, { trimImageData: true, noBackground: true });
    const parsed = agPsd.readPsd(exportedBytes, {
      useImageData: true,
      skipThumbnail: true
    });
    const outer = parsed.children[0];
    const inner = outer.children[0];

    const secondImport = await OS._loadPSDFile(new File(
      [exportedBytes],
      'nested-roundtrip.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const second = summarizeDocument();
    document.querySelector('.psd-compat-report')?.remove();

    const clippedBytes = agPsd.writePsd({
      width: 8,
      height: 8,
      canvas: makeCanvas('#cc2233', 8, 8),
      children: [{
        name: 'Clipped glow',
        clipping: true,
        canvas: makeCanvas('#2244cc', 8, 8)
      }]
    });
    const fallbackImport = await OS._loadPSDFile(new File(
      [clippedBytes],
      'unsupported.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const fallback = {
      layers: OS.layers.map((layer) => layer.name),
      warning: document.querySelector('.psd-compat-report')?.innerText || '',
      flattened: OS._lastPSDImportReport?.flattenWholeDocument
    };

    return {
      firstImport,
      secondImport,
      fallbackImport,
      first,
      second,
      importWarning,
      exportWarnings: built.report.warnings,
      parsed: {
        hasComposite: Boolean(parsed.imageData),
        rootNames: parsed.children.map((child) => child.name),
        outer: {
          opacity: outer.opacity,
          blendMode: outer.blendMode,
          opened: outer.opened
        },
        innerNames: inner.children.map((child) => child.name),
        leaves: inner.children.map((child) => ({
          name: child.name,
          opacity: child.opacity,
          blendMode: child.blendMode,
          text: child.text?.text || null
        }))
      },
      fallback
    };
  });

  expect(result.firstImport).toBe(true);
  expect(result.secondImport).toBe(true);
  expect(result.fallbackImport).toBe(true);
  for (const snapshot of [result.first, result.second]) {
    expect(snapshot.compositeLayerCount).toBe(0);
    expect(snapshot.layers.map((layer) => layer.name)).toEqual(['Background', 'Blue', 'Caption']);
    expect(snapshot.layers[1]).toEqual(expect.objectContaining({
      opacity: 50,
      blend: 'multiply',
      type: 'image'
    }));
    expect(snapshot.layers[1].effectiveOpacity).toBeCloseTo(0.375, 2);
    expect(snapshot.layers[2]).toEqual(expect.objectContaining({
      opacity: 60,
      blend: 'screen',
      type: 'i-text',
      text: 'Hello'
    }));
    expect(snapshot.groups.map((group) => group.name)).toEqual(['Outer', 'Inner']);
    expect(snapshot.groups[0]).toEqual(expect.objectContaining({
      parentId: null,
      blendMode: 'pass through',
      opened: false
    }));
    expect(snapshot.groups[0].opacity).toBeCloseTo(0.75, 2);
  }
  expect(result.importWarning).toContain('group opacity is approximated');
  expect(result.exportWarnings).toEqual([]);
  expect(result.parsed.hasComposite).toBe(true);
  expect(result.parsed.rootNames).toEqual(['Outer']);
  expect(result.parsed.outer.opacity).toBeCloseTo(0.75, 2);
  expect(result.parsed.outer.blendMode).toBe('pass through');
  expect(result.parsed.outer.opened).toBe(false);
  expect(result.parsed.innerNames).toEqual(['Blue', 'Caption']);
  expect(result.parsed.leaves).toEqual([
    expect.objectContaining({ name: 'Blue', blendMode: 'multiply', text: null }),
    expect.objectContaining({ name: 'Caption', blendMode: 'screen', text: 'Hello' })
  ]);
  expect(result.parsed.leaves[0].opacity).toBeCloseTo(0.5, 2);
  expect(result.parsed.leaves[1].opacity).toBeCloseTo(0.6, 2);
  expect(result.fallback).toEqual(expect.objectContaining({
    layers: ['Background', 'PSD Flattened Appearance'],
    flattened: true
  }));
  expect(result.fallback.warning).toContain('one flattened appearance layer instead of duplicating the composite');
  expect(result.fallback.warning).toContain('clipping relationships are not supported');
  expect(pageErrors).toEqual([]);
});

test('rejects hostile or cancelled PSD work without mutating the open document', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    const makeHeader = ({ width = 4, height = 4 } = {}) => {
      const bytes = new Uint8Array(26);
      bytes.set([0x38, 0x42, 0x50, 0x53], 0);
      const view = new DataView(bytes.buffer);
      view.setUint16(4, 1, false);
      view.setUint16(12, 4, false);
      view.setUint32(14, height, false);
      view.setUint32(18, width, false);
      view.setUint16(22, 8, false);
      view.setUint16(24, 3, false);
      return bytes;
    };
    const summary = () => JSON.stringify({
      dimensions: [OS.canvasW, OS.canvasH],
      layers: OS.layers.map((layer) => [layer.name, layer.objects.map((object) => object.name)]),
      objects: OS.canvas.getObjects().map((object) => object.name),
      history: OS.history.map((entry) => entry.action),
      generation: OS._documentGeneration,
      name: OS._docName
    });
    const before = summary();

    const huge = await OS._loadPSDFile(new File(
      [makeHeader({ width: OS._psdLimits.maxDimension + 1 })],
      'huge.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const afterHuge = summary();

    const truncated = await OS._loadPSDFile(new File(
      [makeHeader()],
      'truncated.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const afterTruncated = summary();

    const decode = OS._decodePSDInWorker;
    OS._decodePSDInWorker = async (bytes, size) => ({
      header: OS._readPSDHeader(bytes),
      psd: {
        width: 4,
        height: 4,
        decodedBytes: OS._psdLimits.maxDecodedBytes + 1,
        composite: null,
        children: []
      }
    });
    const overBudget = await OS._loadPSDFile(new File(
      [makeHeader()],
      'decompression-heavy.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    const afterOverBudget = summary();

    OS._decodePSDInWorker = (bytes, size, job) => new Promise((resolve, reject) => {
      job.reject = reject;
    });
    const pendingCancellation = OS._loadPSDFile(new File(
      [makeHeader()],
      'cancel.psd',
      { type: 'image/vnd.adobe.photoshop' }
    ));
    while (!OS._psdDecodeJob?.reject) await new Promise((resolve) => setTimeout(resolve, 0));
    const cancelAccepted = OS._cancelPSDImport();
    const cancelled = await pendingCancellation;
    const afterCancelled = summary();
    OS._decodePSDInWorker = decode;

    return {
      huge,
      truncated,
      overBudget,
      cancelAccepted,
      cancelled,
      atomic: [afterHuge, afterTruncated, afterOverBudget, afterCancelled].every((value) => value === before),
      progressClosed: !document.getElementById('psd-import-progress')
    };
  });

  expect(result).toEqual({
    huge: false,
    truncated: false,
    overBudget: false,
    cancelAccepted: true,
    cancelled: false,
    atomic: true,
    progressClosed: true
  });
});

test('stores atomic recovery generations, falls back from corruption, and forks cross-tab ownership', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const hostedHtml = await readFile(join(process.cwd(), 'index.html'), 'utf8');
  await page.route('http://localhost/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: hostedHtml
  }));
  await page.goto('http://localhost/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => OS.dismissWelcome());
  await page.waitForTimeout(100);

  const first = await page.evaluate(async () => {
    clearInterval(OS._autoSaveTimer);
    OS._autoSaveTimer = null;
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OS._recoveryDirectoryName, { recursive: true }).catch(() => {});
    await root.removeEntry('openshop-autosave.json').catch(() => {});
    OS.createNewDocument(64, 48, { resetProject: true });
    OS._docName = 'Recovery Primary';
    OS._markDocumentDirty();
    await OS._autoSave();
    const records = await OS._listRecoveryGenerations();
    return {
      documentId: OS._documentId,
      records: records.map((record) => ({
        filename: record.filename,
        documentId: record.documentId,
        ownerId: record.ownerId,
        schemaVersion: record.envelope?.schemaVersion,
        checksumAlgorithm: record.checksumAlgorithm,
        valid: record.valid
      }))
    };
  });

  expect(first.records).toHaveLength(1);
  expect(first.records[0]).toEqual(expect.objectContaining({
    documentId: first.documentId,
    schemaVersion: 1,
    checksumAlgorithm: 'sha256',
    valid: true
  }));

  const secondPage = await page.context().newPage();
  const secondErrors = [];
  secondPage.on('pageerror', (error) => secondErrors.push(error.message));
  await secondPage.route('http://localhost/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: hostedHtml
  }));
  await secondPage.goto('http://localhost/index.html', { waitUntil: 'domcontentloaded' });
  await secondPage.evaluate(() => {
    OS.dismissWelcome();
    document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.remove());
  });
  await secondPage.waitForTimeout(100);
  const second = await secondPage.evaluate(async (documentId) => {
    clearInterval(OS._autoSaveTimer);
    OS._autoSaveTimer = null;
    OS.createNewDocument(64, 48, { resetProject: true });
    OS._documentId = documentId;
    OS._docName = 'Recovery Competing Tab';
    OS._initRecoveryCoordination();
    OS._claimRecoveryOwnership();
    await new Promise((resolve) => setTimeout(resolve, 80));
    OS._markDocumentDirty();
    const saved = await OS._autoSave();
    const records = await OS._listRecoveryGenerations();
    return {
      saved,
      documentId: OS._documentId,
      forked: OS._documentId !== documentId,
      recordDocumentIds: records.filter((record) => record.valid).map((record) => record.documentId),
      toast: document.getElementById('toast-container').textContent
    };
  }, first.documentId);
  await secondPage.close();

  expect(second.saved).toBe(true);
  expect(second.forked).toBe(true);
  expect(new Set(second.recordDocumentIds).size).toBe(2);
  expect(second.toast).toContain('separate copy');
  expect(secondErrors).toEqual([]);

  const generations = await page.evaluate(async () => {
    for (let index = 0; index < 2; index++) {
      OS.layers[1].name = `Checkpoint ${index + 2}`;
      OS._markDocumentDirty();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await OS._autoSave();
    }
    const records = await OS._listRecoveryGenerations();
    const primary = records.filter((record) => record.valid && record.documentId === OS._documentId);
    const newest = primary[0];
    const directory = await OS._getRecoveryDirectory(false);
    const handle = await directory.getFileHandle(newest.filename, { create: false });
    const writable = await handle.createWritable();
    await writable.write('{"truncated":');
    await writable.close();
    const info = await OS._getRecoveryInfo();
    const directoryEntries = [];
    const recoveryDirectory = await OS._getRecoveryDirectory(false);
    for await (const [name] of recoveryDirectory.entries()) directoryEntries.push(name);
    await OS.showRecoveryManager();
    const manager = document.querySelector('.recovery-manager');
    const verifiedCard = [...manager.querySelectorAll('.recovery-generation')]
      .find((card) => !card.classList.contains('corrupt'));
    verifiedCard?.querySelector('.recovery-actions .btn')?.click();
    const managerState = {
      text: manager.textContent,
      cards: [...manager.querySelectorAll('.recovery-generation')].map((card) => card.textContent),
      restoreButtons: [...manager.querySelectorAll('.recovery-actions .btn-primary')].map((button) => button.disabled),
      previewVisible: verifiedCard ? !verifiedCard.querySelector('.recovery-details').hidden : false
    };
    document.querySelector('.modal-overlay:has(.recovery-manager)')?.remove();
    return {
      filenames: records.map((record) => record.filename),
      primaryCount: primary.length,
      fallbackUsed: info.fallbackUsed,
      recoverableFilename: info.recoverable?.filename,
      corruptedFilename: newest.filename,
      newestCorrupt: info.generations[0]?.corrupt,
      directoryEntries,
      managerState
    };
  });

  expect(new Set(generations.filenames).size).toBe(generations.filenames.length);
  expect(generations.primaryCount).toBe(3);
  expect(generations.fallbackUsed).toBe(true);
  expect(generations.newestCorrupt).toBe(true);
  expect(generations.recoverableFilename).not.toBe(generations.corruptedFilename);
  expect(generations.directoryEntries).toContain('index.json');
  expect(generations.directoryEntries.some((name) => name.startsWith('.tmp-'))).toBe(false);
  expect(generations.managerState.text).toContain('newest generation is corrupt');
  expect(generations.managerState.text).toContain('Durability');
  expect(generations.managerState.text).toContain('Storage Used');
  expect(generations.managerState.cards.some((card) => card.includes('Corrupt'))).toBe(true);
  expect(generations.managerState.restoreButtons).toContain(true);
  expect(generations.managerState.restoreButtons).toContain(false);
  expect(generations.managerState.previewVisible).toBe(true);

  const renamed = await page.evaluate(async () => {
    const info = await OS._getRecoveryInfo();
    const record = info.recoverable;
    await OS._renameRecoveryGeneration(record, 'Named checkpoint');
    const records = await OS._listRecoveryGenerations();
    const named = records.find((candidate) => candidate.label === 'Named checkpoint');
    return {
      exists: Boolean(named),
      filename: named?.filename,
      documentId: named?.documentId,
      label: named?.label
    };
  });
  expect(renamed).toEqual(expect.objectContaining({
    exists: true,
    label: 'Named checkpoint',
    documentId: first.documentId
  }));

  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(async (filename) => {
    const record = (await OS._listRecoveryGenerations()).find((candidate) => candidate.filename === filename);
    OS._exportRecovery(record);
  }, renamed.filename);
  const recoveryDownload = await downloadPromise;
  expect(recoveryDownload.suggestedFilename()).toBe('Named_checkpoint.openshop');

  const restoredCopy = await page.evaluate(async ({ filename, originalDocumentId }) => {
    const record = (await OS._listRecoveryGenerations()).find((candidate) => candidate.filename === filename);
    const restored = await OS._restoreRecoveryRecord(record, null, true);
    return {
      restored,
      documentId: OS._documentId,
      changedId: OS._documentId !== originalDocumentId,
      name: OS._docName,
      dirty: OS._isDirty
    };
  }, { filename: renamed.filename, originalDocumentId: first.documentId });
  expect(restoredCopy).toEqual(expect.objectContaining({
    restored: true,
    changedId: true,
    name: 'Recovery Primary Copy',
    dirty: true
  }));

  const finalState = await page.evaluate(async (corruptedFilename) => {
    const records = await OS._listRecoveryGenerations();
    const corrupt = records.find((record) => record.filename === corruptedFilename);
    await OS._discardRecovery(corrupt);
    const remaining = await OS._listRecoveryGenerations();
    const corruptRemoved = !remaining.some((record) => record.filename === corruptedFilename);
    await OS._discardAllRecovery(remaining);
    const root = await navigator.storage.getDirectory();
    const legacyHandle = await root.getFileHandle('openshop-autosave.json', { create: true });
    const legacyWritable = await legacyHandle.createWritable();
    await legacyWritable.write(JSON.stringify(OS._captureDocumentState()));
    await legacyWritable.close();
    const migrated = await OS._migrateLegacyRecovery();
    const legacyExists = Boolean(await root.getFileHandle('openshop-autosave.json', { create: false }).catch(() => null));
    const migratedRecords = await OS._listRecoveryGenerations();
    const migratedLabel = migratedRecords.find((record) => record.valid)?.label || '';
    await OS._discardAllRecovery(migratedRecords);
    return {
      corruptRemoved,
      migrated,
      legacyExists,
      migratedLabel,
      remainingAfterCleanup: (await OS._listRecoveryGenerations()).length
    };
  }, generations.corruptedFilename);
  expect(finalState).toEqual({
    corruptRemoved: true,
    migrated: true,
    legacyExists: false,
    migratedLabel: 'Migrated legacy autosave',
    remainingAfterCleanup: 0
  });
  expect(pageErrors).toEqual([]);
});

test('round-trips one document state through save, open, recovery, undo, and redo', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  await page.evaluate(() => {
    OS.createNewDocument(320, 240);
    OS._docName = 'Golden Document';

    const rect = new fabric.Rect({
      left: 14,
      top: 18,
      width: 90,
      height: 60,
      fill: '#336699',
      name: 'Masked subject',
      opacity: 0.65,
      visible: false,
      selectable: false,
      evented: false,
      globalCompositeOperation: 'multiply'
    });
    rect.clipPath = new fabric.Rect({
      originX: 'center',
      originY: 'center',
      width: 64,
      height: 36
    });
    rect._hasMask = true;
    OS.canvas.add(rect);
    Object.assign(OS.layers[1], {
      name: 'Subject',
      visible: false,
      locked: true,
      opacity: 65,
      blend: 'multiply',
      objects: [rect]
    });

    OS.addLayer();
    const text = new fabric.IText('Top label', {
      left: 130,
      top: 42,
      fontSize: 22,
      fill: '#ffffff',
      name: 'Top label',
      opacity: 0.8,
      globalCompositeOperation: 'screen'
    });
    OS.canvas.add(text);
    Object.assign(OS.layers[2], {
      name: 'Labels',
      visible: true,
      locked: false,
      opacity: 80,
      blend: 'screen',
      objects: [text]
    });
    OS.activeLayerIdx = 2;
    OS.canvas.setActiveObject(text);

    OS.addGuide('horizontal', 37, { silent: true, recordHistory: false });
    OS.addGuide('vertical', 91, { silent: true, recordHistory: false });
    const mask = new Uint8Array(64);
    [9, 10, 17, 18].forEach((index) => { mask[index] = 1; });
    OS._selectionMask = { w: 8, h: 8, mask };
    OS._selectionBounds = { x: 1, y: 1, w: 2, h: 2 };
    const frame = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==';
    OS._animFrames = [frame, frame];
    OS._animIdx = 1;
    OS.saveHistory('Golden document');
    window.showSaveFilePicker = undefined;
  });

  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => OS.saveProject());
  const download = await downloadPromise;
  const savedPath = await download.path();
  const projectText = await readFile(savedPath, 'utf8');
  const savedState = JSON.parse(projectText);
  expect(savedState).toEqual(expect.objectContaining({
    kind: 'openshop-document',
    schemaVersion: 1,
    canvas: expect.objectContaining({ width: 320, height: 240 }),
    layers: expect.any(Array)
  }));
  expect(savedState.layers).toHaveLength(3);

  const summarize = () => page.evaluate(() => ({
    dimensions: [OS.canvasW, OS.canvasH],
    documentName: OS._docName,
    layers: OS.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blend: layer.blend,
      objects: layer.objects.filter((object) => !object.excludeFromExport).map((object) => object.name)
    })),
    zOrder: OS.canvas.getObjects().filter((object) => !object.excludeFromExport).map((object) => object.name),
    masked: Boolean(OS.layers[1]?.objects[0]?._hasMask && OS.layers[1]?.objects[0]?.clipPath),
    guides: OS.guides.map((guide) => [guide.orientation, guide.pos]),
    selection: {
      bounds: OS._selectionBounds,
      selected: OS._selectionMask ? [...OS._selectionMask.mask].filter(Boolean).length : 0
    },
    activeLayer: OS.layers[OS.activeLayerIdx]?.name,
    activeObject: OS.canvas.getActiveObject()?.name || null,
    animation: [OS._animFrames.length, OS._animIdx],
    projectHandleCleared: OS._projectFileHandle === null
  }));

  const newDocumentClearedHandle = await page.evaluate(() => {
    OS._projectFileHandle = { stale: true };
    OS.createNewDocument(64, 64, { resetProject: true });
    return OS._projectFileHandle === null;
  });
  expect(newDocumentClearedHandle).toBe(true);
  await page.evaluate(() => { OS._projectFileHandle = { stale: true }; });
  await page.locator('#project-input').setInputFiles({
    name: 'golden.openshop.json',
    mimeType: 'application/json',
    buffer: Buffer.from(projectText)
  });
  // The new document above left unsaved changes, so opening prompts first.
  await page.locator('.modal-overlay:has-text("Discard unsaved changes?") button:text-is("Discard")').click();
  await expect(page.locator('#toast-container')).toContainText('Project loaded');
  const opened = await summarize();

  await page.evaluate(async (text) => {
    OS._projectFileHandle = { stale: true };
    OS.createNewDocument(80, 80);
    await OS._restoreRecoveryText(text);
  }, projectText);
  const recovered = await summarize();

  await page.evaluate(() => {
    OS.layers[2].name = 'Changed labels';
    OS.activeLayerIdx = 1;
    OS.canvas.discardActiveObject();
    OS._selectionMask = null;
    OS._selectionBounds = null;
    OS.guides[0].pos = 123;
    OS.saveHistory('Mutated document');
  });
  await page.evaluate(() => OS.undo());
  const undone = await summarize();
  await page.evaluate(() => OS.redo());
  const redone = await summarize();

  const golden = {
    dimensions: [320, 240],
    documentName: 'Golden Document',
    layers: [
      { name: 'Background', visible: true, locked: true, opacity: 100, blend: 'source-over', objects: ['__boundary__'] },
      { name: 'Subject', visible: false, locked: true, opacity: 65, blend: 'multiply', objects: ['Masked subject'] },
      { name: 'Labels', visible: true, locked: false, opacity: 80, blend: 'screen', objects: ['Top label'] }
    ],
    zOrder: ['__boundary__', 'Masked subject', 'Top label'],
    masked: true,
    guides: [['horizontal', 37], ['vertical', 91]],
    selection: { bounds: { x: 1, y: 1, w: 2, h: 2 }, selected: 4 },
    activeLayer: 'Labels',
    activeObject: 'Top label',
    animation: [2, 1],
    projectHandleCleared: true
  };
  expect(opened).toEqual(golden);
  expect(recovered).toEqual(golden);
  expect(undone).toEqual(golden);
  expect(redone).toEqual(expect.objectContaining({
    layers: expect.arrayContaining([expect.objectContaining({ name: 'Changed labels' })]),
    activeLayer: 'Subject',
    activeObject: null,
    selection: { bounds: null, selected: 0 },
    guides: [['horizontal', 123], ['vertical', 91]]
  }));
});

test('keeps layer stacking, locks, visibility, and history in one canonical model', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    OS.createNewDocument(240, 180);
    const lower = new fabric.Rect({
      left: 20,
      top: 20,
      width: 120,
      height: 100,
      fill: '#cc3344',
      name: 'Lower object'
    });
    OS.canvas.add(lower);
    OS.layers[1].name = 'Lower';
    OS.layers[1].objects.push(lower);

    OS.layers.push({
      id: OS._newDocumentId('layer'),
      name: 'Upper',
      visible: true,
      locked: false,
      opacity: 100,
      blend: 'source-over',
      objects: []
    });
    OS.activeLayerIdx = 2;
    const upper = new fabric.Rect({
      left: 45,
      top: 35,
      width: 120,
      height: 100,
      fill: '#3366dd',
      name: 'Upper object'
    });
    OS.canvas.add(upper);
    OS.layers[2].objects.push(upper);
    OS._enforceLayerInvariants();
    OS.updateLayersPanel();
    OS.history = [];
    OS.historyIdx = -1;
    OS.saveHistory('Layer Baseline', { markDirty: false });

    OS.renameLayer(2, 'Foreground');
    OS.setLayerOpacity(60);
    OS.setLayerBlend('multiply');
    OS.canvas.setActiveObject(upper);
    OS.toggleLayerLock(2);
    const discardedOnLock = !OS.canvas.getActiveObject();
    OS.setTool('select');
    const lockedInteraction = {
      selectable: upper.selectable,
      evented: upper.evented
    };
    OS.setTool('brush');
    const drawingWhileLocked = OS.canvas.isDrawingMode;
    OS.toggleLayerVisibility(2);
    const hiddenInteraction = {
      visible: upper.visible,
      selectable: upper.selectable,
      evented: upper.evented
    };
    OS.toggleLayerVisibility(2);
    OS._moveLayer(2, 1);

    const summarize = () => ({
      layerNames: OS.layers.map((layer) => layer.name),
      panelNames: [...document.querySelectorAll('#layers-list .layer-name')].map((node) => node.textContent),
      canvasOrder: OS.canvas.getObjects().map((object) => object.name),
      foreground: (() => {
        const layer = OS.layers.find((candidate) => candidate.name === 'Foreground');
        if (!layer) return null;
        return {
          visible: layer.visible,
          locked: layer.locked,
          opacity: layer.opacity,
          blend: layer.blend,
          objects: layer.objects.map((object) => object.name)
        };
      })()
    });
    const final = summarize();
    const project = OS._captureDocumentState();

    for (let index = 0; index < 7; index++) await OS.undo();
    const undone = summarize();
    for (let index = 0; index < 7; index++) await OS.redo();
    const redone = summarize();

    await OS._loadDocumentState(project);
    const reopened = summarize();
    const restoredUpper = OS.layers.find((layer) => layer.name === 'Foreground').objects[0];
    OS.setTool('select');

    return {
      discardedOnLock,
      lockedInteraction,
      drawingWhileLocked,
      hiddenInteraction,
      historyActions: OS.history.map((entry) => entry.action),
      final,
      undone,
      redone,
      reopened,
      reopenedInteraction: {
        selectable: restoredUpper.selectable,
        evented: restoredUpper.evented
      }
    };
  });

  expect(result.discardedOnLock).toBe(true);
  expect(result.lockedInteraction).toEqual({ selectable: false, evented: false });
  expect(result.drawingWhileLocked).toBe(false);
  expect(result.hiddenInteraction).toEqual({ visible: false, selectable: false, evented: false });
  expect(result.historyActions).toEqual([
    'Layer Baseline',
    'Rename Layer',
    'Layer Opacity',
    'Blend: multiply',
    'Lock Layer',
    'Hide Layer',
    'Show Layer',
    'Reorder Layers'
  ]);
  expect(result.undone.layerNames).toEqual(['Background', 'Lower', 'Upper']);
  expect(result.final).toEqual({
    layerNames: ['Background', 'Foreground', 'Lower'],
    panelNames: ['Lower', 'Foreground', 'Background'],
    canvasOrder: ['__boundary__', 'Upper object', 'Lower object'],
    foreground: {
      visible: true,
      locked: true,
      opacity: 60,
      blend: 'multiply',
      objects: ['Upper object']
    }
  });
  expect(result.redone).toEqual(result.final);
  expect(result.reopened).toEqual(result.final);
  expect(result.reopenedInteraction).toEqual({ selectable: false, evented: false });
});

test('records validated commands and replays mixed edits as one atomic action', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    OS.createNewDocument(160, 120, { resetProject: true, clean: true });
    const subject = new fabric.Rect({
      left: 20,
      top: 18,
      width: 70,
      height: 50,
      fill: '#c43d55',
      name: 'Subject'
    });
    OS.canvas.add(subject);
    OS.layers[1].name = 'Subject layer';
    OS.layers[1].objects.push(subject);
    OS.canvas.setActiveObject(subject);
    OS._enforceLayerInvariants();
    OS.updateLayersPanel();
    OS._initializeHistory('Command Baseline');
    OS._markDocumentClean(OS._historyBaseSnapshot, 'clean');

    const summarize = () => {
      const object = OS.canvas.getObjects().find((candidate) => candidate.name === 'Subject');
      const layer = OS.layers.find((candidate) => candidate.objects.includes(object));
      return {
        layerName: layer?.name,
        opacity: layer?.opacity,
        angle: object?.angle || 0,
        active: OS.canvas.getActiveObject()?.name || null
      };
    };
    const baseline = summarize();
    const initializationTransactions = OS.history.length;

    OS._macroSteps = [];
    OS._macroRecording = true;
    OS.renameLayer(OS.activeLayerIdx, 'Retouched subject');
    OS.setLayerOpacity(75, false);
    OS.setLayerOpacity(55, false);
    const previewHistoryLength = OS.history.length;
    OS.commitLayerOpacity();
    OS.canvas.setActiveObject(subject);
    OS.rotateObj(30);
    OS._macroRecording = false;

    const recorded = JSON.parse(JSON.stringify(OS._macroSteps));
    const edited = summarize();
    const transactionIds = OS.history.map((entry) => entry.command?.id);

    for (let index = 0; index < 3; index++) await OS.undo();
    const undone = summarize();
    const replaySucceeded = await OS.playMacro();
    const replayed = summarize();
    const replayEntry = OS.history.at(-1);

    const beforeFailure = JSON.stringify(OS._captureDocumentState());
    const beforeFailureHistoryLength = OS.history.length;
    const layerId = OS.layers.find((layer) => layer.name === 'Retouched subject').id;
    const failedSequence = OS._makeCommand('macro.sequence', {
      commands: [
        OS._makeCommand('layer.rename', { layerId, name: 'Must roll back' }),
        OS._makeCommand('object.rotate', { objectId: 'object-does-not-exist', degrees: 45 })
      ]
    });
    const failedSequenceResult = await OS._executeCommand(failedSequence, { recordMacro: false });
    const afterFailure = JSON.stringify(OS._captureDocumentState());

    const invalidResult = await OS._executeCommand({
      schemaVersion: 1,
      id: 'layer.opacity.set',
      args: { layerId, opacity: 999 }
    }, { recordMacro: false });

    return {
      initializationTransactions,
      previewHistoryLength,
      baseline,
      edited,
      undone,
      replaySucceeded,
      replayed,
      recorded,
      transactionIds,
      replayEntry: {
        kind: replayEntry?.kind,
        schemaVersion: replayEntry?.schemaVersion,
        commandId: replayEntry?.command?.id,
        childIds: replayEntry?.command?.args?.commands?.map((command) => command.id)
      },
      failedSequenceResult,
      failureRolledBack: beforeFailure === afterFailure,
      failureHistoryUnchanged: OS.history.length === beforeFailureHistoryLength,
      invalidResult,
      layerNameAfterFailures: OS.layers.find((layer) => layer.id === layerId)?.name
    };
  });

  expect(result.initializationTransactions).toBe(0);
  expect(result.previewHistoryLength).toBe(1);
  expect(result.transactionIds).toEqual(['layer.rename', 'layer.opacity.set', 'object.rotate']);
  expect(result.recorded.map((command) => [command.schemaVersion, command.id])).toEqual([
    [1, 'layer.rename'],
    [1, 'layer.opacity.set'],
    [1, 'object.rotate']
  ]);
  expect(result.recorded.every((command) => !('timestamp' in command) && !('action' in command))).toBe(true);
  expect(result.undone).toEqual(result.baseline);
  expect(result.replaySucceeded).toBe(true);
  expect(result.replayed).toEqual(result.edited);
  expect(result.replayEntry).toEqual({
    kind: 'openshop-history-entry',
    schemaVersion: 1,
    commandId: 'macro.sequence',
    childIds: ['layer.rename', 'layer.opacity.set', 'object.rotate']
  });
  expect(result.failedSequenceResult).toBe(false);
  expect(result.failureRolledBack).toBe(true);
  expect(result.failureHistoryUnchanged).toBe(true);
  expect(result.invalidResult).toBe(false);
  expect(result.layerNameAfterFailures).toBe('Retouched subject');
  expect(pageErrors).toEqual([]);
});

test('undoes destructive canvas and frame transactions without state loss', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    OS.createNewDocument(96, 64, { resetProject: true, clean: true });
    const subject = new fabric.Rect({
      left: 12,
      top: 10,
      width: 42,
      height: 30,
      fill: '#d1425b',
      name: 'Subject'
    });
    OS.canvas.add(subject);
    OS.layers[1].name = 'Subject';
    OS.layers[1].objects.push(subject);
    OS.canvas.setActiveObject(subject);
    OS._enforceLayerInvariants();
    OS.updateLayersPanel();
    OS._initializeHistory('Destructive Baseline');
    OS._markDocumentClean(OS._historyBaseSnapshot, 'clean');

    const snapshot = () => JSON.stringify(OS._captureDocumentState());
    const baseline = snapshot();
    const operations = [];
    const verifyOperation = async (id, run) => {
      const succeeded = await run();
      const after = snapshot();
      const entryId = OS.history.at(-1)?.command?.id;
      const undoSucceeded = await OS.undo();
      const exactUndo = snapshot() === baseline;
      const redoSucceeded = await OS.redo();
      const exactRedo = snapshot() === after;
      await OS.undo();
      operations.push({ id, succeeded, entryId, undoSucceeded, exactUndo, redoSucceeded, exactRedo });
    };

    await verifyOperation('canvas.flatten', () => OS.flattenImage());
    await verifyOperation('canvas.rotate', () => OS.canvasRotate(90));
    await verifyOperation('canvas.flip', () => OS.canvasFlip('h'));
    await verifyOperation('canvas.crop', () => {
      const vpt = OS.canvas.viewportTransform;
      OS._cropRegion = {
        x: vpt[4] + 8 * vpt[0],
        y: vpt[5] + 6 * vpt[3],
        w: 60 * vpt[0],
        h: 40 * vpt[3]
      };
      return OS.applyCrop();
    });

    const originalFromURL = fabric.Image.fromURL;
    const beforeFailure = snapshot();
    const historyBeforeFailure = OS.history.length;
    fabric.Image.fromURL = () => Promise.reject(new Error('Synthetic image decode failure'));
    const failedFlatten = await OS.flattenImage();
    fabric.Image.fromURL = originalFromURL;
    const failedFlattenRolledBack = snapshot() === beforeFailure && OS.history.length === historyBeforeFailure;

    const frameBase = snapshot();
    const addSucceeded = await OS.addFrame();
    const afterAdd = snapshot();
    await OS.undo();
    const addUndoExact = snapshot() === frameBase;
    await OS.redo();
    const addRedoExact = snapshot() === afterAdd;

    await OS.addFrame();
    const liveSubject = OS.canvas.getObjects().find((object) => object.name === 'Subject');
    liveSubject.set('fill', '#315fd1');
    OS.canvas.renderAll();
    const beforeSelect = snapshot();
    const selectSucceeded = await OS.selectFrame(0);
    const afterSelect = snapshot();
    await OS.undo();
    const selectUndoExact = snapshot() === beforeSelect;
    await OS.redo();
    const selectRedoExact = snapshot() === afterSelect;
    await OS.undo();

    const beforeDuplicate = snapshot();
    const duplicateSucceeded = await OS.dupFrame();
    const afterDuplicate = snapshot();
    await OS.undo();
    const duplicateUndoExact = snapshot() === beforeDuplicate;
    await OS.redo();
    const duplicateRedoExact = snapshot() === afterDuplicate;
    await OS.undo();

    const beforeRemove = snapshot();
    const removeSucceeded = await OS.removeFrame(0);
    const afterRemove = snapshot();
    await OS.undo();
    const removeUndoExact = snapshot() === beforeRemove;
    await OS.redo();
    const removeRedoExact = snapshot() === afterRemove;

    return {
      operations,
      failedFlatten,
      failedFlattenRolledBack,
      frames: {
        addSucceeded,
        addUndoExact,
        addRedoExact,
        selectSucceeded,
        selectUndoExact,
        selectRedoExact,
        duplicateSucceeded,
        duplicateUndoExact,
        duplicateRedoExact,
        removeSucceeded,
        removeUndoExact,
        removeRedoExact
      }
    };
  });

  expect(result.operations).toEqual([
    expect.objectContaining({ id: 'canvas.flatten', succeeded: true, entryId: 'canvas.flatten', undoSucceeded: true, exactUndo: true, redoSucceeded: true, exactRedo: true }),
    expect.objectContaining({ id: 'canvas.rotate', succeeded: true, entryId: 'canvas.rotate', undoSucceeded: true, exactUndo: true, redoSucceeded: true, exactRedo: true }),
    expect.objectContaining({ id: 'canvas.flip', succeeded: true, entryId: 'canvas.flip', undoSucceeded: true, exactUndo: true, redoSucceeded: true, exactRedo: true }),
    expect.objectContaining({ id: 'canvas.crop', succeeded: true, entryId: 'canvas.crop', undoSucceeded: true, exactUndo: true, redoSucceeded: true, exactRedo: true })
  ]);
  expect(result.failedFlatten).toBe(false);
  expect(result.failedFlattenRolledBack).toBe(true);
  expect(result.frames).toEqual({
    addSucceeded: true,
    addUndoExact: true,
    addRedoExact: true,
    selectSucceeded: true,
    selectUndoExact: true,
    selectRedoExact: true,
    duplicateSucceeded: true,
    duplicateUndoExact: true,
    duplicateRedoExact: true,
    removeSucceeded: true,
    removeUndoExact: true,
    removeRedoExact: true
  });
  expect(pageErrors).toEqual([]);
});

test('exports real alpha or matte pixels and presents format loss before download', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    OS.createNewDocument(32, 24, { resetProject: true, clean: true });
    const card = new fabric.Rect({
      left: 2,
      top: 2,
      width: 8,
      height: 8,
      fill: '#e43f55',
      strokeWidth: 0,
      name: 'Card'
    });
    OS.canvas.add(card);
    OS.layers[1].name = 'Card';
    OS.layers[1].objects.push(card);
    const captionLayer = {
      id: OS._newDocumentId('layer'),
      name: 'Caption',
      visible: true,
      locked: false,
      opacity: 100,
      blend: 'source-over',
      objects: []
    };
    const caption = new fabric.IText('A', {
      left: 13,
      top: 3,
      fontSize: 8,
      fill: '#ffffff',
      name: 'Caption'
    });
    OS.canvas.add(caption);
    captionLayer.objects.push(caption);
    OS.layers.push(captionLayer);
    OS.activeLayerIdx = 2;
    OS._enforceLayerInvariants();
    OS.updateLayersPanel();
    OS._initializeHistory('Export Baseline');
    OS._markDocumentDirty();

    const sample = (dataUrl, x, y) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        resolve([...context.getImageData(x, y, 1, 1).data]);
      };
      image.onerror = reject;
      image.src = dataUrl;
    });
    const waitForPreview = (overlay, labelPrefix) => new Promise((resolve, reject) => {
      const deadline = performance.now() + 2000;
      const check = () => {
        const label = overlay.querySelector('#es-preview')?.getAttribute('aria-label') || '';
        if (label.startsWith(labelPrefix)) {
          resolve(label);
        } else if (performance.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${labelPrefix} export preview`));
        } else {
          setTimeout(check, 16);
        }
      };
      check();
    });

    const stateBefore = JSON.stringify(OS._captureDocumentState());
    const viewportBefore = OS.canvas.viewportTransform.slice();
    const dirtyBefore = {
      dirty: OS._isDirty,
      autoSaveDirty: OS._autoSaveDirty,
      revision: OS._documentRevision,
      historyLength: OS.history.length
    };
    const transparentPng = OS._captureExportRaster({ format: 'png', transparent: true });
    const mattePng = OS._captureExportRaster({ format: 'png', transparent: false, matte: '#00ff00' });
    const transparentWebp = OS._captureExportRaster({ format: 'webp', transparent: true, quality: 1 });
    const jpeg = OS._captureExportRaster({ format: 'jpeg', transparent: true, matte: '#00ff00', quality: 1 });
    const pixels = {
      transparentPng: await sample(transparentPng.dataUrl, 30, 22),
      mattePng: await sample(mattePng.dataUrl, 30, 22),
      transparentWebp: await sample(transparentWebp.dataUrl, 30, 22),
      jpeg: await sample(jpeg.dataUrl, 30, 22)
    };
    const boundary = OS.canvas.getObjects().find((object) => object.name === '__boundary__');
    const svgProbe = OS._withExportCanvasState({ transparent: true }, () => ({
      source: OS.canvas.toSVG({
        viewBox: { x: 0, y: 0, width: OS.canvasW, height: OS.canvasH },
        width: OS.canvasW,
        height: OS.canvasH
      }),
      boundaryOpacity: boundary.opacity,
      boundaryExcluded: boundary.excludeFromExport
    }));
    const svgBoundaryRestored = boundary.opacity === 1 && boundary.excludeFromExport === false;

    window.__pdfProbe = {};
    window.jspdf = {
      jsPDF: class {
        constructor(options) { window.__pdfProbe.options = options; }
        addImage(dataUrl) { window.__pdfProbe.dataUrl = dataUrl; }
        save(filename) { window.__pdfProbe.filename = filename; }
      }
    };
    const pdfSucceeded = OS.exportPDF({ matte: '#00ff00' });
    const pdfPixel = await sample(window.__pdfProbe.dataUrl, 30, 22);

    const originalToDataURL = OS.canvas.toDataURL;
    OS.canvas.toDataURL = () => { throw new Error('Synthetic export failure'); };
    const failedExport = OS.saveFile('png');
    OS.canvas.toDataURL = originalToDataURL;

    const stateAfter = JSON.stringify(OS._captureDocumentState());
    const dirtyAfter = {
      dirty: OS._isDirty,
      autoSaveDirty: OS._autoSaveDirty,
      revision: OS._documentRevision,
      historyLength: OS.history.length
    };
    const overlay = OS.showExportSettings('jpeg');
    overlay.querySelector('#es-matte').value = '#00ff00';
    overlay.querySelector('#es-matte').dispatchEvent(new Event('input', { bubbles: true }));
    await waitForPreview(overlay, 'JPEG');
    const jpegUi = {
      alphaDisabled: overlay.querySelector('#es-transparent').disabled,
      alphaChecked: overlay.querySelector('#es-transparent').checked,
      matteVisible: overlay.querySelector('#es-matte-row').style.display,
      previewLabel: overlay.querySelector('#es-preview').getAttribute('aria-label'),
      impact: overlay.querySelector('#es-impact').textContent,
      projectPromptVisible: !overlay.querySelector('#es-project-state').hidden
    };
    overlay.querySelector('[data-fmt="png"]').click();
    const alpha = overlay.querySelector('#es-transparent');
    alpha.checked = false;
    alpha.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForPreview(overlay, 'PNG');
    const pngMatteUi = {
      alphaDisabled: alpha.disabled,
      matteVisible: overlay.querySelector('#es-matte-row').style.display,
      previewLabel: overlay.querySelector('#es-preview').getAttribute('aria-label')
    };
    overlay.remove();

    return {
      pixels,
      svg: {
        checkerExcluded: !svgProbe.source.includes('<pattern'),
        boundaryOpacityDuringExport: svgProbe.boundaryOpacity,
        boundaryExcludedDuringExport: svgProbe.boundaryExcluded,
        boundaryRestored: svgBoundaryRestored
      },
      pdf: {
        succeeded: pdfSucceeded,
        pixel: pdfPixel,
        filename: window.__pdfProbe.filename
      },
      jpegTransparentOption: jpeg.options.transparent,
      stateRestored: stateAfter === stateBefore,
      viewportRestored: JSON.stringify(OS.canvas.viewportTransform) === JSON.stringify(viewportBefore),
      dirtyUnchanged: JSON.stringify(dirtyAfter) === JSON.stringify(dirtyBefore),
      failedExport,
      jpegUi,
      pngMatteUi
    };
  });

  expect(result.pixels.transparentPng[3]).toBe(0);
  expect(result.pixels.transparentWebp[3]).toBe(0);
  expect(result.pixels.mattePng).toEqual([0, 255, 0, 255]);
  expect(result.pixels.jpeg[1]).toBeGreaterThan(180);
  expect(result.pixels.jpeg[0]).toBeLessThan(80);
  expect(result.pixels.jpeg[2]).toBeLessThan(80);
  expect(result.pixels.jpeg[3]).toBe(255);
  expect(result.svg).toEqual({
    checkerExcluded: true,
    boundaryOpacityDuringExport: 0,
    boundaryExcludedDuringExport: true,
    boundaryRestored: true
  });
  expect(result.pdf.succeeded).toBe(true);
  expect(result.pdf.pixel).toEqual([0, 255, 0, 255]);
  expect(result.pdf.filename).toBe('Untitled.pdf');
  expect(result.jpegTransparentOption).toBe(false);
  expect(result.stateRestored).toBe(true);
  expect(result.viewportRestored).toBe(true);
  expect(result.dirtyUnchanged).toBe(true);
  expect(result.failedExport).toBe(false);
  expect(result.jpegUi).toEqual(expect.objectContaining({
    alphaDisabled: true,
    alphaChecked: false,
    matteVisible: 'flex',
    projectPromptVisible: true
  }));
  expect(result.jpegUi.previewLabel).toContain('JPEG · matte #00ff00');
  expect(result.jpegUi.impact).toContain('2 editable layers will be flattened');
  expect(result.jpegUi.impact).toContain('1 text object will no longer be editable');
  expect(result.jpegUi.impact).toContain('JPEG has no alpha channel');
  expect(result.jpegUi.impact).toContain('does not save the editable project');
  expect(result.pngMatteUi).toEqual({
    alphaDisabled: false,
    matteVisible: 'flex',
    previewLabel: 'PNG · matte #00ff00'
  });
  expect(pageErrors).toEqual([]);
});

test('mirrors tool, layer, selection, and actions for assistive tech', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  await page.locator('button[title="New Layer"]').click();

  const result = await page.evaluate(() => {
    OS.setTool('brush');
    OS._selectionBounds = { x: 3, y: 4, w: 12, h: 14 };
    OS._selectionMask = { w: 32, h: 32, mask: new Uint8Array(32 * 32) };
    OS._selectionMask.mask[0] = 1;
    OS._selectionMask.mask[1] = 1;
    OS.saveHistory('Accessibility Smoke');
    OS.toast('Accessibility status');
    return {
      summary: document.getElementById('canvas-a11y-summary').textContent,
      tool: document.getElementById('canvas-a11y-tool').textContent,
      layer: document.getElementById('canvas-a11y-layer').textContent,
      selection: document.getElementById('canvas-a11y-selection').textContent,
      live: document.getElementById('canvas-a11y-live').textContent,
      canvasLabel: document.getElementById('canvas-area').getAttribute('aria-label'),
      roleDescription: document.getElementById('canvas-area').getAttribute('aria-roledescription'),
      layerItems: document.querySelectorAll('#canvas-a11y-layers li').length
    };
  });

  expect(result.roleDescription).toBe('image editor canvas');
  expect(result.tool).toBe('Tool: Brush');
  expect(result.layer).toContain('Layer');
  expect(result.selection).toContain('2 pixels selected');
  expect(result.summary).toContain('Last action: Accessibility Smoke');
  expect(result.live).toBe('Accessibility status');
  expect(result.canvasLabel).toContain('Tool: Brush');
  expect(result.layerItems).toBeGreaterThan(0);
});

test('keeps onboarding actions reachable across supported narrow viewports', async ({ page }) => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 568, height: 320 },
    { width: 667, height: 375 },
    { width: 1024, height: 768 }
  ];

  await page.setViewportSize(viewports[0]);
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.locator('#welcome-overlay')).toBeVisible();
    await page.evaluate(() => {
      document.getElementById('welcome-overlay').scrollTop = 0;
      document.querySelector('.welcome-launch').scrollTop = 0;
    });

    const actions = page.locator('.welcome-actions button');
    await expect(actions).toHaveCount(4);
    for (let index = 0; index < await actions.count(); index++) {
      const action = actions.nth(index);
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    const layout = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
      welcomeOverflow: document.getElementById('welcome-overlay').scrollWidth >
        document.getElementById('welcome-overlay').clientWidth
    }));
    expect(layout).toEqual({ pageOverflow: false, welcomeOverflow: false });

    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox.x).toBeGreaterThanOrEqual(0);
    expect(toolbarBox.y).toBeGreaterThanOrEqual(0);
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(viewport.width);
    expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(viewport.height);
  }

  const enterStudio = page.getByRole('button', { name: 'Enter Studio' });
  await enterStudio.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#welcome-overlay')).toHaveClass(/hidden/);
});

test('keeps dialog actions visible and operable across narrow portrait and landscape layouts', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 568, height: 320 },
    { width: 667, height: 375 },
    { width: 1024, height: 768 }
  ];
  const dialogs = ['newImage', 'showPreferences', 'showExportSettings', 'showShortcuts', 'showRecoveryManager'];

  await page.setViewportSize(viewports[0]);
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => OS.dismissWelcome());
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const dialog of dialogs) {
      await page.evaluate(async (name) => {
        const result = OS[name]();
        if (result?.then) await result;
      }, dialog);

      const overlay = page.locator('.modal-overlay').last();
      const modal = overlay.locator('.modal');
      await expect(modal).toBeVisible();
      await expect(overlay).toHaveClass(/show/);
      await page.waitForTimeout(25);
      const modalBox = await modal.boundingBox();
      expect(modalBox.x).toBeGreaterThanOrEqual(0);
      expect(modalBox.y).toBeGreaterThanOrEqual(0);
      expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(viewport.width);
      expect(modalBox.y + modalBox.height).toBeLessThanOrEqual(viewport.height);

      const actions = modal.locator('.modal-btns button');
      expect(await actions.count()).toBeGreaterThan(0);
      for (let index = 0; index < await actions.count(); index++) {
        const action = actions.nth(index);
        const box = await action.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(box.height).toBeGreaterThanOrEqual(43);
        expect(await action.evaluate((button) => parseFloat(getComputedStyle(button).minHeight))).toBeGreaterThanOrEqual(44);
      }

      if (dialog === 'showPreferences' && viewport.width === 320) {
        await modal.locator('#pref-grid').fill('24');
        await modal.locator('[data-modal-action]').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.modal-overlay')).toHaveCount(0);
        expect(await page.evaluate(() => OS.gridSize)).toBe(24);
      } else if (dialog === 'showRecoveryManager' && viewport.width === 375) {
        await modal.getByRole('button', { name: 'Close' }).click();
        await expect(page.locator('.modal-overlay')).toHaveCount(0);
      } else {
        await page.keyboard.press('Escape');
        await expect(page.locator('.modal-overlay')).toHaveCount(0);
      }
    }
  }
});

test('renders persisted UI data without activating markup', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const payload = '<img src=x onerror=alert(1)>';
    localStorage.setItem('openshop_recent', JSON.stringify([
      { name: payload, dims: '<svg onload=alert(2)>', date: '<script>alert(3)</script>' }
    ]));
    localStorage.setItem('os_palette', JSON.stringify(['#112233', 'javascript:alert(1)', '#AABBCC']));
    localStorage.setItem('os_presets', JSON.stringify([
      { name: payload, adjustments: { brightness: 20 }, custom: true }
    ]));
    OS.populateRecentFiles();
    OS.loadSavedPalette();
    OS.showPresets();
  });

  await expect(page.locator('#recent-files-area img')).toHaveCount(0);
  await expect(page.locator('#recent-files-area script')).toHaveCount(0);
  await expect(page.locator('#recent-files-area')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#palette-saved .palette-swatch')).toHaveCount(2);
  await expect(page.locator('.modal-overlay .modal img')).toHaveCount(0);
  await expect(page.locator('.modal-overlay .modal script')).toHaveCount(0);
  await expect(page.locator('.modal-overlay .modal')).toContainText('<img src=x onerror=alert(1)>');
});

test('keeps zoom cheap and coalesces inspector redraws after edits', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const result = await page.evaluate(async () => {
    // Make the navigator visible so the minimap actually renders.
    document.querySelector('[data-os-click="click-186"]').click();

    const calls = [];
    const originalToDataURL = OS.canvas.toDataURL.bind(OS.canvas);
    OS.canvas.toDataURL = (options = {}) => {
      calls.push({ multiplier: options.multiplier ?? 1, width: options.width });
      return originalToDataURL(options);
    };
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // Zoom must not re-capture the composite at all.
    calls.length = 0;
    for (let i = 0; i < 12; i += 1) {
      OS.onMouseWheel({ e: { preventDefault() {}, deltaY: -40, offsetX: 100, offsetY: 100 } });
    }
    await frame();
    const capturesDuringZoom = calls.length;

    // A burst of edits collapses into a single coalesced capture.
    calls.length = 0;
    for (let i = 0; i < 8; i += 1) {
      OS.canvas.add(new fabric.Rect({ left: i * 4, top: 4, width: 6, height: 6, fill: '#3978ff' }));
      OS.saveHistory(`Draw rect ${i}`);
    }
    await frame();
    const capturesAfterEdits = calls.length;
    const thumbnailMultiplier = calls.length ? calls[0].multiplier : null;

    OS.canvas.toDataURL = originalToDataURL;
    return { capturesDuringZoom, capturesAfterEdits, thumbnailMultiplier };
  });

  expect(result.capturesDuringZoom).toBe(0);
  expect(result.capturesAfterEdits).toBe(1);
  // The minimap renders at thumbnail scale, not full document resolution.
  expect(result.thumbnailMultiplier).toBeLessThan(1);
});

test('applies every theme across the studio chrome and persists the choice', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enter Studio' }).click();

  const sample = () => page.evaluate(() => {
    const bg = (sel) => {
      const el = document.querySelector(sel);
      const style = getComputedStyle(el);
      return style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor;
    };
    return {
      topbar: bg('#topbar'),
      toolbar: bg('#toolbar'),
      canvasArea: getComputedStyle(document.querySelector('#canvas-area')).backgroundColor,
      statusbar: bg('#statusbar'),
      panel: bg('.panel-tabs')
    };
  });

  const seen = {};
  for (const theme of ['default', 'midnight', 'oled']) {
    await page.evaluate((t) => OS.setTheme(t, { silent: true, persist: false }), theme);
    seen[theme] = await sample();
  }

  // Every chrome surface must actually change between themes.
  for (const surface of Object.keys(seen.default)) {
    expect(seen.default[surface], surface).not.toBe(seen.oled[surface]);
    expect(seen.default[surface], surface).not.toBe(seen.midnight[surface]);
    expect(seen.midnight[surface], surface).not.toBe(seen.oled[surface]);
  }
  // OLED drives the canvas well to near black.
  expect(seen.oled.canvasArea).toBe('rgb(3, 4, 5)');

  // The choice survives a reload.
  await page.evaluate(() => OS.setTheme('oled'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/theme-oled/);
});

test('exposes onboarding and layer controls to the keyboard', async ({ page }) => {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  // Template cards are reachable and operable without a mouse.
  const card = page.locator('#template-grid .template-card').first();
  await expect(card).toHaveJSProperty('tagName', 'BUTTON');
  await expect(card).toHaveAttribute('aria-label', /\d+ by \d+ pixels/);
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#welcome-overlay')).toBeHidden();

  // Icon-only layer controls carry accessible names.
  const visibility = page.locator('#layers-list .layer-vis').first();
  await expect(visibility).toHaveAttribute('aria-label', /(Hide|Show) layer/);
  const lock = page.locator('#layers-list .layer-lock').first();
  await expect(lock).toHaveAttribute('aria-label', /(Lock|Unlock) layer/);

  // New Image size presets are buttons, not click-only divs.
  await page.evaluate(() => OS.newImage());
  const preset = page.locator('.modal-overlay .preset-btn').first();
  await expect(preset).toHaveJSProperty('tagName', 'BUTTON');
  await preset.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ni-w')).toHaveValue('1920');
});
