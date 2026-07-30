import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
const productionRevision = '0.20.0-r3';

async function setServerState(request, state = {}) {
  const response = await request.post(`${origin}/__test/control`, {
    data: {
      revision: productionRevision,
      badShell: false,
      networkDown: false,
      ...state
    }
  });
  expect(response.ok()).toBe(true);
}

async function clearOfflineState(page) {
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('openshop-')).map(name => caches.delete(name)));
  });
}

test.describe('hosted offline contract', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ request }) => {
    await setServerState(request);
  });

  test.afterEach(async ({ page, request, context }) => {
    await context.setOffline(false);
    await setServerState(request);
    if (!page.isClosed()) await clearOfflineState(page);
  });

  test('caches the complete core shell and reloads it offline', async ({ page, context, request, browserName }) => {
    test.setTimeout(60000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#editor-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Enter Studio' }).click();
    await expect(page.locator('#offline-state')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    const status = await page.evaluate(() => OS._requestOfflineWorker('OPENSHOP_GET_STATUS'));
    expect(status.shellReady).toBe(true);
    expect(status.requiredCached).toBe(status.requiredTotal);

    await page.locator('#offline-state').click();
    await expect(page.getByRole('dialog', { name: 'Offline & Install' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Offline & Install' })).toContainText('No cached model responses');
    await page.getByRole('button', { name: 'Close' }).click();

    if (browserName === 'webkit') await setServerState(request, { networkDown: true });
    else await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#editor-canvas')).toBeVisible();
    await expect(page.locator('#offline-state-label')).toHaveText('Offline ready');
    expect(pageErrors).toEqual([]);
  });

  test('declares supported file handlers and consumes a queued project launch', async ({ page, request }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: {
          setConsumer(callback) {
            window.__openshopLaunchConsumer = callback;
          }
        }
      });
    });

    const manifestResponse = await request.get(`${origin}/manifest.webmanifest`);
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest.file_handlers[0].accept['image/vnd.adobe.photoshop']).toContain('.psd');
    expect(manifest.file_handlers[0].accept['application/vnd.openshop+json']).toContain('.openshop');

    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#editor-canvas')).toBeVisible();
    const result = await page.evaluate(async () => {
      const project = OS._captureDocumentState();
      project.document.name = 'Launched Project';
      const file = new File([JSON.stringify(project)], 'launched.openshop', {
        type: 'application/vnd.openshop+json'
      });
      window.__openshopLaunchConsumer({
        files: [{
          async getFile() {
            return file;
          }
        }]
      });
      await new Promise((resolve, reject) => {
        const started = performance.now();
        const poll = () => {
          if (OS._docName === 'Launched Project' && document.getElementById('welcome-overlay').classList.contains('hidden')) return resolve();
          if (performance.now() - started > 5000) return reject(new Error('Launch queue project was not consumed'));
          setTimeout(poll, 25);
        };
        poll();
      });
      return {
        name: OS._docName,
        state: OS._persistenceState,
        welcomeHidden: document.getElementById('welcome-overlay').classList.contains('hidden')
      };
    });

    expect(result).toEqual({
      name: 'Launched Project',
      state: 'clean',
      welcomeHidden: true
    });
  });

  test('returns to the last verified shell when an update cannot confirm boot', async ({ page, request }) => {
    test.setTimeout(90000);
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#offline-state')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

    await setServerState(request, { revision: 'test-v2-bad', badShell: true });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await page.waitForFunction(() => Boolean(OS._pwaRegistration?.waiting));
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const changed = new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
      registration.waiting.postMessage({ type: 'OPENSHOP_APPLY_UPDATE' });
      await changed;
    });

    // A single unconfirmed navigation is normal (second tab, refresh during
    // load, quick close) and must not roll the update back.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#bad-shell')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#bad-shell')).toBeVisible();
    // The trial shell has no OS object, so ask the worker directly.
    const stillTrialling = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => resolve(event.data?.status);
        setTimeout(() => reject(new Error('worker status timed out')), 5000);
        registration.active.postMessage({ type: 'OPENSHOP_GET_STATUS' }, [channel.port2]);
      });
    });
    expect(stillTrialling.rolledBackFrom).toBeFalsy();
    expect(stillTrialling.activeRevision).toBe('test-v2-bad');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#bad-shell')).toBeVisible();

    // Repeated failures to confirm do roll back.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#editor-canvas')).toBeVisible();
    const status = await page.evaluate(() => OS._requestOfflineWorker('OPENSHOP_GET_STATUS'));
    expect(status.activeRevision).toBe(productionRevision);
    expect(status.rolledBackFrom).toBe('test-v2-bad');
    expect(status.shellReady).toBe(true);
  });
});
