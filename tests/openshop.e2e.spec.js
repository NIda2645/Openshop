import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const appUrl = pathToFileURL(join(process.cwd(), 'index.html')).toString();

test('loads the editor shell and supports core UI interactions', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
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
  await expect(page.locator('#persistence-state-label')).toHaveText('Clean');
  expect(await unloadPrevented()).toBe(false);

  await page.locator('button[title="New Layer"]').click();
  await expect(page.locator('#persistence-state')).toHaveAttribute('data-state', 'dirty');
  await expect(page.locator('#persistence-state-label')).toHaveText('Unsaved');
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
  await expect(page.locator('#persistence-state-label')).toHaveText('Saved');
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
  expect(result.activeName).toBe('Filter: Sharpen');
  expect(typeof result.photonDisabled).toBe('boolean');
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

test('loads the editor on a mobile viewport without clipped controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#editor-canvas')).toBeVisible();
  await page.evaluate(() => OS.dismissWelcome());

  const toolbar = page.locator('#toolbar');
  await expect(toolbar).toBeVisible();
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox.width).toBeGreaterThan(0);
  expect(toolbarBox.height).toBeGreaterThan(0);

  const selectTool = page.locator('.tool-btn[data-tool="select"]').first();
  await expect(selectTool).toBeVisible();
  const toolBox = await selectTool.boundingBox();
  expect(toolBox.x).toBeGreaterThanOrEqual(0);
  expect(toolBox.y).toBeGreaterThanOrEqual(0);
  expect(toolBox.x + toolBox.width).toBeLessThanOrEqual(375);

  const canvas = page.locator('#editor-canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox.width).toBeGreaterThan(50);
  expect(canvasBox.height).toBeGreaterThan(50);

  const result = await page.evaluate(() => ({
    canvasVisible: document.getElementById('editor-canvas')?.offsetWidth > 0,
    toolbarVisible: document.getElementById('toolbar')?.offsetWidth > 0,
    noPageErrors: true
  }));
  expect(result.canvasVisible).toBe(true);
  expect(result.toolbarVisible).toBe(true);
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
