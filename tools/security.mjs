import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const write = process.argv.includes('--write');
const EXPECTED_INLINE_SCRIPTS = 2;
const EXPECTED_BOOT_ASSETS = 3;
const EXPECTED_RUNTIME_ASSETS = 15;
const VERIFIED_ASSET_ORIGINS = new Set(['https://cdn.jsdelivr.net']);
const SCRIPT_SOURCE_TOKENS = new Set(["'self'", "'wasm-unsafe-eval'", 'blob:']);
const REQUIRED_POLICY_DIRECTIVES = new Map([
  ['base-uri', ["'none'"]],
  ['object-src', ["'none'"]],
  ['frame-ancestors', ["'none'"]],
  ['connect-src', null]
]);

export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, source]) => {
      const normalized = source.replace(/\r\n?/g, '\n');
      return `sha256-${createHash('sha256').update(normalized, 'utf8').digest('base64')}`;
    });
}

export function contentSecurityPolicy(html) {
  const match = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i);
  if (!match) throw new Error('Content-Security-Policy meta tag is missing');
  return { full: match[0], value: match[1] };
}

function policyDirectives(policy) {
  return policy.split(';')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const [name, ...sources] = value.split(/\s+/);
      return { name: name.toLowerCase(), sources, value };
    });
}

export function updatePolicy(html) {
  const policy = contentSecurityPolicy(html);
  const hashes = inlineScriptHashes(html).map(value => `'${value}'`);
  const directives = policy.value.split(';').map(value => value.trim()).filter(Boolean);
  const index = directives.findIndex(value => /^script-src(?:\s|$)/i.test(value));
  if (index < 0) throw new Error('script-src directive is missing');
  directives[index] = [
    "script-src 'self'",
    ...hashes,
    "'wasm-unsafe-eval'",
    'blob:'
  ].join(' ');
  const nextPolicy = `${directives.join('; ')};`;
  const nextTag = policy.full.replace(policy.value, () => nextPolicy);
  return html.replace(policy.full, () => nextTag);
}

function verifiedAssets(block, label, expectedCount, failures) {
  const assets = [...block.matchAll(
    /url\s*:\s*'([^']+)'\s*,\s*\n\s*integrity\s*:\s*'(sha384-[A-Za-z0-9+/=]+)'/g
  )].map(([, url, integrity]) => ({ url, integrity }));

  if (assets.length !== expectedCount) {
    failures.push(`expected ${expectedCount} verified ${label} assets, found ${assets.length}`);
  }
  if (new Set(assets.map(asset => asset.url)).size !== assets.length) {
    failures.push(`verified ${label} asset URLs are not unique`);
  }
  for (const asset of assets) {
    let origin;
    try {
      origin = new URL(asset.url).origin;
    } catch {
      failures.push(`verified ${label} asset URL is invalid: ${asset.url}`);
      continue;
    }
    if (!VERIFIED_ASSET_ORIGINS.has(origin)) {
      failures.push(`verified ${label} asset uses an unauthorized origin: ${asset.url}`);
    }
  }
  return assets;
}

export function check(html) {
  const failures = [];
  const policy = contentSecurityPolicy(html).value;
  const directives = policyDirectives(policy);
  const directiveNames = directives.map(directive => directive.name);
  for (const name of new Set(directiveNames)) {
    if (directiveNames.filter(value => value === name).length > 1) {
      failures.push(`duplicate CSP directive: ${name}`);
    }
  }
  const byName = new Map(directives.map(directive => [directive.name, directive]));
  const scriptDirective = byName.get('script-src');
  const scriptSources = scriptDirective?.sources || [];
  if (!scriptDirective) failures.push('script-src directive is missing');
  for (const overridingName of ['script-src-elem', 'script-src-attr']) {
    if (byName.has(overridingName)) {
      failures.push(`${overridingName} is forbidden because it can override the audited script-src contract`);
    }
  }
  if (scriptSources.includes("'unsafe-inline'")) failures.push("script-src still permits 'unsafe-inline'");
  if (scriptSources.includes("'unsafe-eval'")) failures.push("script-src permits unrestricted 'unsafe-eval'");
  if (!scriptSources.includes("'wasm-unsafe-eval'")) {
    failures.push("script-src does not narrowly authorize verified WebAssembly");
  }
  for (const source of scriptSources) {
    if (/^'nonce-/i.test(source)) {
      failures.push(`script-src nonce sources are forbidden: ${source}`);
      continue;
    }
    if (SCRIPT_SOURCE_TOKENS.has(source) || /^'sha256-[A-Za-z0-9+/=]+'$/.test(source)) continue;
    failures.push(`script-src contains an unauthorized source: ${source}`);
  }

  for (const [name, requiredSources] of REQUIRED_POLICY_DIRECTIVES) {
    const directive = byName.get(name);
    if (!directive) {
      failures.push(`${name} directive is missing`);
      continue;
    }
    if (requiredSources && (directive.sources.length !== requiredSources.length
        || requiredSources.some(source => !directive.sources.includes(source)))) {
      failures.push(`${name} must be exactly ${requiredSources.join(' ')}`);
    }
  }

  const inlineHashes = inlineScriptHashes(html);
  const expectedHashes = new Set(inlineHashes);
  const declaredHashes = new Set(
    scriptSources
      .filter(source => /^'sha(?:256|384|512)-[A-Za-z0-9+/=]+'$/i.test(source))
      .map(source => source.slice(1, -1))
  );
  if (expectedHashes.size !== declaredHashes.size
      || [...expectedHashes].some(hash => !declaredHashes.has(hash))) {
    failures.push('inline script hashes do not match the current source');
  }
  if (inlineHashes.length !== EXPECTED_INLINE_SCRIPTS) {
    failures.push(`expected ${EXPECTED_INLINE_SCRIPTS} inline scripts, found ${inlineHashes.length}`);
  }

  // Any inline handler, not just the four the registry happens to use: an
  // onerror= or onload= used to sail through the gate that claims to cover them.
  const inlineHandler = [...html.matchAll(/<[a-z][^>]*>/gi)]
    .map(match => match[0].match(/[\s/]on[a-z]+\s*=/i))
    .find(Boolean);
  if (inlineHandler) {
    failures.push(`executable HTML event attribute remains: ${inlineHandler[0].trim()}`);
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
    if (/\bsrc\s*=/i.test(match[1]) && !/\bintegrity\s*=\s*"sha384-[A-Za-z0-9+/=]+"/i.test(match[1])) {
      failures.push(`external script lacks SHA-384 integrity: ${match[0]}`);
    }
  }

  const bootBlock = html.match(/const OPENSHOP_BOOT_ASSETS = Object\.freeze\(\[([\s\S]*?)\n\]\);/);
  if (!bootBlock) {
    failures.push('verified boot asset manifest is missing');
  } else {
    verifiedAssets(bootBlock[1], 'boot', EXPECTED_BOOT_ASSETS, failures);
  }

  const runtimeBlock = html.match(/_runtimeAssets:\s*Object\.freeze\(\{([\s\S]*?)\n\s*\}\),\n\s*_runtimeAssetPromises:/);
  if (!runtimeBlock) {
    failures.push('verified runtime asset manifest is missing');
  } else {
    verifiedAssets(runtimeBlock[1], 'lazy', EXPECTED_RUNTIME_ASSETS, failures);
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
    inlineScripts: inlineHashes.length,
    actions: declaredActions.length,
    registryEntries: registryIds.size,
    lazyAssets: EXPECTED_RUNTIME_ASSETS,
    bootAssets: EXPECTED_BOOT_ASSETS
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let html = readFileSync(indexPath, 'utf8');
  if (write) {
    html = updatePolicy(html);
    writeFileSync(indexPath, html);
  }
  const result = check(html);
  console.log(`Security contract OK: ${result.inlineScripts} hashed scripts, ${result.actions} controls, ${result.registryEntries} actions, ${result.bootAssets} verified boot assets, ${result.lazyAssets} verified lazy assets.`);
}
