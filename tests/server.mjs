import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.OPENSHOP_TEST_PORT || 4173);
const productionRevision = '0.20.0-r3';
let workerRevision = productionRevision;
let badShell = false;
let networkDown = false;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png'
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    ...headers
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (url.pathname === '/__test/control' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const state = JSON.parse(body || '{}');
    workerRevision = String(state.revision || productionRevision);
    badShell = Boolean(state.badShell);
    networkDown = Boolean(state.networkDown);
    send(response, 200, JSON.stringify({ workerRevision, badShell, networkDown }), {
      'content-type': 'application/json; charset=utf-8'
    });
    return;
  }

  if (networkDown) {
    send(response, 503, 'Simulated origin outage', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  if (badShell && (url.pathname === '/' || url.pathname === '/index.html')) {
    send(
      response,
      200,
      '<!doctype html><html><head><meta charset="utf-8"><title>Broken trial shell</title></head><body><main id="bad-shell">Broken trial shell</main></body></html>',
      { 'content-type': 'text/html; charset=utf-8' }
    );
    return;
  }

  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    send(response, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    let body = await readFile(file);
    if (url.pathname === '/sw.js') {
      const source = body.toString('utf8');
      body = source.replace(
        `const SHELL_REVISION = '${productionRevision}';`,
        `const SHELL_REVISION = '${workerRevision.replace(/[^a-zA-Z0-9._-]/g, '')}';`
      );
    }
    send(response, 200, body, {
      'content-type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream',
      ...(url.pathname === '/sw.js' ? { 'service-worker-allowed': './' } : {})
    });
  } catch {
    send(response, 404, 'Not found', { 'content-type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`OpenShop test server listening on http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
