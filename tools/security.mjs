import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const write = process.argv.includes('--write');

function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, source]) => {
      const normalized = source.replace(/\r\n?/g, '\n');
      return `sha256-${createHash('sha256').update(normalized, 'utf8').digest('base64')}`;
    });
}

function contentSecurityPolicy(html) {
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i);
  if (!match) throw new Error('Content-Security-Policy meta tag is missing');
  return { full: match[0], value: match[1] };
}

function updatePolicy(html) {
  const policy = contentSecurityPolicy(html);
  const hashes = inlineScriptHashes(html).map(value => `'${value}'`);
  const directives = policy.value.split(';').map(value => value.trim()).filter(Boolean);
  const index = directives.findIndex(value => value.startsWith('script-src '));
  if (index < 0) throw new Error('script-src directive is missing');
  directives[index] = [
    "script-src 'self'",
    ...hashes,
    "'wasm-unsafe-eval'",
    'https://cdn.jsdelivr.net',
    'blob:'
  ].join(' ');
  const nextPolicy = `${directives.join('; ')};`;
  return html.replace(policy.full, policy.full.replace(policy.value, nextPolicy));
}

function check(html) {
  const failures = [];
  const policy = contentSecurityPolicy(html).value;
  const scriptDirective = policy.split(';').map(value => value.trim())
    .find(value => value.startsWith('script-src '));
  if (!scriptDirective) failures.push('script-src directive is missing');
  if (scriptDirective?.includes("'unsafe-inline'")) failures.push("script-src still permits 'unsafe-inline'");
  if (scriptDirective?.split(/\s+/).includes("'unsafe-eval'")) failures.push("script-src permits unrestricted 'unsafe-eval'");
  if (!scriptDirective?.split(/\s+/).includes("'wasm-unsafe-eval'")) {
    failures.push("script-src does not narrowly authorize verified WebAssembly");
  }

  const expectedHashes = new Set(inlineScriptHashes(html));
  const declaredHashes = new Set(
    [...(scriptDirective || '').matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map(match => match[1])
  );
  if (expectedHashes.size !== declaredHashes.size
      || [...expectedHashes].some(hash => !declaredHashes.has(hash))) {
    failures.push('inline script hashes do not match the current source');
  }

  if (/\son(?:click|change|input|keydown)\s*=/i.test(html)) {
    failures.push('executable HTML event attributes remain');
  }

  const registryIds = new Set(
    [...html.matchAll(/^\s*"((?:click|change|input|keydown)-[^"]+)":\s*function\b/gm)]
      .map(match => match[1])
  );
  const declaredActions = [...html.matchAll(/\sdata-os-(?:click|change|input|keydown)="([^"]+)"/g)]
    .map(match => match[1]);
  const missingActions = [...new Set(declaredActions.filter(id => !registryIds.has(id)))];
  if (missingActions.length) failures.push(`undeclared UI actions: ${missingActions.join(', ')}`);

  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (/\bsrc=/i.test(match[1]) && !/\bintegrity="sha384-[A-Za-z0-9+/=]+"/i.test(match[1])) {
      failures.push(`external script lacks SHA-384 integrity: ${match[0]}`);
    }
  }

  const runtimeBlock = html.match(/_runtimeAssets:\s*Object\.freeze\(\{([\s\S]*?)\n\s*\}\),\n\s*_runtimeAssetPromises:/);
  if (!runtimeBlock) {
    failures.push('verified runtime asset manifest is missing');
  } else {
    const assets = [...runtimeBlock[1].matchAll(
      /url:'(https:\/\/[^']+)',\s*\n\s*integrity:'(sha384-[A-Za-z0-9+/=]+)'/g
    )];
    if (assets.length !== 8) failures.push(`expected 8 verified lazy assets, found ${assets.length}`);
    if (new Set(assets.map(match => match[1])).size !== assets.length) {
      failures.push('verified lazy asset URLs are not unique');
    }
  }

  if (/(?:import|importScripts)\s*\(\s*['"`]https?:/i.test(html)
      || /workerScript\s*:\s*['"]https?:/i.test(html)
      || /\.src\s*=\s*['"]https?:\/\/(?:cdn\.jsdelivr|cdnjs)/i.test(html)) {
    failures.push('a lazy executable path bypasses the verified runtime loader');
  }

  if (failures.length) {
    throw new Error(`Security contract failed:\n- ${failures.join('\n- ')}`);
  }
  return {
    inlineScripts: expectedHashes.size,
    actions: declaredActions.length,
    registryEntries: registryIds.size,
    lazyAssets: 8
  };
}

let html = readFileSync(indexPath, 'utf8');
if (write) {
  html = updatePolicy(html);
  writeFileSync(indexPath, html);
}
const result = check(html);
console.log(`Security contract OK: ${result.inlineScripts} hashed scripts, ${result.actions} controls, ${result.registryEntries} actions, ${result.lazyAssets} verified lazy assets.`);
