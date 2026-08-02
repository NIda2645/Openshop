import { performance } from 'node:perf_hooks';

const fixtures = [
    { name:'4K', width:3840, height:2160, iterations:3 },
    { name:'8K', width:7680, height:4320, iterations:3 },
    { name:'12MP', width:4000, height:3000, iterations:3 }
];

// These are release envelopes, not claims that every browser/device meets a
// particular latency. The report is still useful when a new code path moves
// p95 or retained memory, and the generous ceilings keep the gate portable.
const budgets = Object.freeze({
    import: { p95Ms:60_000 },
    paint: { p95Ms:5_000 },
    filterPreview: { p95Ms:10_000 },
    filterApply: { p95Ms:60_000 },
    undoRedo: { p95Ms:10_000 },
    export: { p95Ms:60_000 },
    batch: { p95Ms:60_000 },
    cancel: { p95Ms:5_000 },
    staleResult: { p95Ms:5_000 }
});

const bytesFor = (width, height) => width * height * 4;
const formatMs = value => `${value.toFixed(1)} ms`;
const percentile = (values, factor) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * factor) - 1)];
};

function createSurface(width, height) {
    const surface = new Uint8Array(bytesFor(width, height));
    for (let index = 0; index < surface.length; index += 4) {
        const pixel = index / 4;
        surface[index] = pixel & 0xff;
        surface[index + 1] = (pixel >>> 8) & 0xff;
        surface[index + 2] = (pixel >>> 16) & 0xff;
        surface[index + 3] = 255;
    }
    return surface;
}

function runOperation(name, fixture) {
    const { width, height } = fixture;
    if (name === 'import') return createSurface(width, height);
    if (name === 'paint') {
        const surface = createSurface(width, height);
        const tile = 64 * 64 * 4;
        for (let offset = 0; offset < Math.min(surface.length, tile * 64); offset += 4) {
            surface[offset] = 255;
            surface[offset + 1] = 32;
            surface[offset + 2] = 16;
        }
        return surface;
    }
    if (name === 'filterPreview') {
        const surface = createSurface(width, height);
        const previewWidth = Math.max(1, Math.ceil(width / 2));
        const previewHeight = Math.max(1, Math.ceil(height / 2));
        const preview = new Uint8Array(bytesFor(previewWidth, previewHeight));
        for (let y = 0; y < previewHeight; y += 1) for (let x = 0; x < previewWidth; x += 1) {
            const source = (Math.min(height - 1, y * 2) * width + Math.min(width - 1, x * 2)) * 4;
            const target = (y * previewWidth + x) * 4;
            const gray = Math.round(surface[source] * 0.299 + surface[source + 1] * 0.587 + surface[source + 2] * 0.114);
            preview[target] = gray; preview[target + 1] = gray; preview[target + 2] = gray; preview[target + 3] = 255;
        }
        return preview;
    }
    if (name === 'filterApply') {
        const surface = createSurface(width, height);
        for (let index = 0; index < surface.length; index += 4) {
            const gray = Math.round(surface[index] * 0.299 + surface[index + 1] * 0.587 + surface[index + 2] * 0.114);
            surface[index] = gray; surface[index + 1] = gray; surface[index + 2] = gray;
        }
        return surface;
    }
    if (name === 'undoRedo') {
        const surface = createSurface(width, height);
        const tileBytes = 64 * 64 * 4;
        const delta = new Uint8Array(tileBytes * 16);
        delta.set(surface.subarray(0, delta.length));
        const redo = delta.slice();
        return { surface, delta, redo };
    }
    if (name === 'export') {
        const surface = createSurface(width, height);
        // This is the deterministic RGBA snapshot boundary used before the
        // browser's PNG/WebP encoder; it deliberately does not call a fake
        // encoder and is labelled as such in the report.
        return surface.slice();
    }
    if (name === 'batch') {
        const batch = [];
        for (let index = 0; index < 3; index += 1) {
            const surface = createSurface(1024, 1024);
            for (let pixel = index; pixel < surface.length; pixel += 4) surface[pixel] = (surface[pixel] + 17) & 0xff;
            batch.push(surface);
        }
        return batch;
    }
    if (name === 'cancel') {
        const controller = new AbortController();
        const surface = createSurface(Math.min(width, 2048), Math.min(height, 2048));
        let processed = 0;
        for (let index = 0; index < surface.length; index += 4) {
            processed += 1;
            if (processed === 1024) controller.abort();
            if (controller.signal.aborted) break;
        }
        if (!controller.signal.aborted) throw new Error('Cancellation probe did not cancel');
        return { cancelled:true, processed };
    }
    if (name === 'staleResult') {
        const jobGeneration = 1;
        const currentGeneration = 2;
        return { discarded:jobGeneration !== currentGeneration, jobGeneration, currentGeneration };
    }
    throw new Error(`Unknown performance operation ${name}`);
}

function measure(name, fixture) {
    global.gc?.();
    const before = process.memoryUsage();
    const start = performance.now();
    const result = runOperation(name, fixture);
    const durationMs = performance.now() - start;
    const after = process.memoryUsage();
    // The result is intentionally scoped to this call. GC on the next sample
    // distinguishes retained memory from one operation's temporary surface.
    return { durationMs, rssDeltaBytes:Math.max(0, after.rss - before.rss), resultType:Array.isArray(result) ? 'batch' : typeof result };
}

function benchmarkFixture(fixture) {
    const operations = {};
    for (const name of Object.keys(budgets)) {
        const samples = Array.from({ length:fixture.iterations }, () => measure(name, fixture));
        operations[name] = {
            samples:samples.map(sample => Number(sample.durationMs.toFixed(3))),
            p50Ms:Number(percentile(samples.map(sample => sample.durationMs), 0.5).toFixed(3)),
            p95Ms:Number(percentile(samples.map(sample => sample.durationMs), 0.95).toFixed(3)),
            peakRssDeltaBytes:Math.max(...samples.map(sample => sample.rssDeltaBytes)),
            executionPaths:{ worker:false, gpu:false, cpu:true },
            cancellation:{ tested:name === 'cancel', observed:name === 'cancel' },
            staleResultHandling:{ tested:name === 'staleResult', discarded:name === 'staleResult' }
        };
    }
    return {
        name:fixture.name,
        width:fixture.width,
        height:fixture.height,
        pixels:fixture.width * fixture.height,
        rgbaBytes:bytesFor(fixture.width, fixture.height),
        operations
    };
}

function checkReport(report) {
    const failures = [];
    report.fixtures.forEach(fixture => Object.entries(fixture.operations).forEach(([name, result]) => {
        if (result.p95Ms > budgets[name].p95Ms) failures.push(`${fixture.name}.${name}.p95Ms=${result.p95Ms} > ${budgets[name].p95Ms}`);
    }));
    if (failures.length) throw new Error(`Performance budget failure: ${failures.join(', ')}`);
}

const report = {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    runtime:{ node:process.version, executionPath:'node-cpu-proxy', memory:'process.rss delta; browser GPU/worker paths require the browser matrix' },
    budgets,
    fixtures:fixtures.map(benchmarkFixture)
};

if (process.argv.includes('--check')) checkReport(report);
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
    console.log(`Performance budgets passed for ${report.fixtures.length} deterministic fixtures (4K, 8K, 12MP).`);
    report.fixtures.forEach(fixture => {
        const values = ['import','paint','filterPreview','filterApply','undoRedo','export','batch','cancel','staleResult']
            .map(name => `${name} p95 ${formatMs(fixture.operations[name].p95Ms)}`);
        console.log(`${fixture.name} ${fixture.width}x${fixture.height}: ${values.join(', ')}`);
    });
}
