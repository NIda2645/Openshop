import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(toolsDirectory, '..');

export function readReleaseMetadata(root = repositoryRoot) {
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const version = String(packageJson.version || '').trim();
    const revision = Number(packageJson.release?.shellRevision);
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('package.json version must be a semantic version');
    if (!Number.isInteger(revision) || revision < 1 || revision > 99) throw new Error('package.json release.shellRevision must be an integer from 1 to 99');
    return Object.freeze({ version, shellRevision:`${version}-r${revision}`, revision });
}

export const releaseMetadata = readReleaseMetadata();
