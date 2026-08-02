import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReleaseMetadata } from '../tools/release-metadata.mjs';

const root = join(process.cwd());
const read = name => readFileSync(join(root, name), 'utf8');

describe('release metadata', () => {
  it('keeps every shipped version and offline shell revision on one source of truth', () => {
    const { version, shellRevision } = readReleaseMetadata(root);
    const index = read('index.html');
    const manifest = JSON.parse(read('manifest.webmanifest'));
    const changelog = read('CHANGELOG.md');
    const readme = read('README.md');
    const serviceWorker = read('sw.js');
    const offlineSpec = read('tests/offline.e2e.spec.js');
    const server = read('tests/server.mjs');

    expect(manifest.version, 'manifest.webmanifest version').toBe(version);
    expect(index, 'index.html title version').toContain(`<title>OpenShop v${version} —`);
    expect(index, 'index.html about version').toContain(`aria-label="OpenShop version ${version}"`);
    expect(index, 'index.html runtime version').toContain(`application: { id:'openshop', version:'${version}'`);
    expect(index, 'index.html document version').toContain(`version: '${version}'`);
    expect(readme, 'README version badge').toContain(`version-${version}-blue`);
    expect(changelog, 'CHANGELOG release heading').toContain(`## [v${version}]`);
    expect(serviceWorker, 'sw.js shell revision').toContain(`const SHELL_REVISION = '${shellRevision}';`);
    expect(offlineSpec, 'offline browser spec revision').toContain('productionRevision = releaseMetadata.shellRevision');
    expect(server, 'offline test server revision').toContain('productionRevision = releaseMetadata.shellRevision');
    expect(serviceWorker, 'sw.js current revision allowlist').toContain('    SHELL_REVISION,');
  });
});
