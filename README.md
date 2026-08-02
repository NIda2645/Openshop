# OpenShop

![Version](https://img.shields.io/badge/version-0.27.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Browser-orange)
![Zero Install](https://img.shields.io/badge/install-none_required-brightgreen)
![Single File](https://img.shields.io/badge/single_file-HTML-E34F26?logo=html5&logoColor=white)

> A free, single-file browser-based image editor with layers, AI tools, pixel-level selections, filters, PSD import/export, and a Photoshop-inspired workflow. No server, no signup, no install.

## Try It Now

**[Open OpenShop in your browser](https://sysadmindoc.github.io/Openshop/)** — no download required.

Or download `index.html` and open it locally. Everything runs client-side. Your images never leave your machine — and the status bar tells you exactly what did, so you can check rather than trust. See [Privacy and Network Use](#privacy-and-network-use).

## Quick Start

1. Visit **https://sysadmindoc.github.io/Openshop/**
2. Or download the single HTML file and open it in any modern browser (network is required for a cold standalone launch)
3. Start editing

**Self-host it** — deploy the static files to a dedicated subdirectory on GitHub Pages, Netlify, S3, or Nginx. There is no build step, bundler, or runtime `node_modules`; include the PWA companions described below if you want verified offline reloads and installation. The service worker controls its containing directory, so do not put `sw.js` at the root of an origin shared with other applications.

## Features

### Core Editor

| Feature | Description |
|---------|-------------|
| **Layer System** | Multi-layer canvas with canonical render/export stacking, protected hidden or locked content, and undoable visibility, lock, opacity, blend, rename, and drag-reorder changes |
| **34 Tools** | Move, Brush, Pencil, Eraser, Spray, Clone Stamp, Healing Brush, Dodge, Burn, Sponge, Smudge, Shapes (rect, ellipse, triangle, polygon, star, arrow, line), Pen, Text, Gradient, Pattern Fill, Flood Fill, Eyedropper, Crop, Measure, Sticky Notes, AI Segment Select, Pan, Zoom |
| **Brush Engine** | Round, Soft, Flat, Scatter, Pixel presets with adjustable size, opacity, and flow |
| **Selection Tools** | Rectangular/Elliptical Marquee, Magic Wand (contiguous + global), Lasso, Color Range dialog with fuzziness, presets, and live preview |
| **Selection Operations** | Select All, Deselect, Reselect, Inverse, Grow, Similar, Modify (Expand, Contract, Feather, Border, Smooth) |
| **Symmetry Drawing** | Horizontal, vertical, both-axes, and radial (6-fold) mirror modes for brush strokes |
| **Undo/Redo** | 60-step versioned transaction history with named entries, exact destructive-edit rollback, and a visual history panel |
| **Snapshots & Branches** | Name the current state and return to it later, outside the undo step limit; editing after an undo archives the abandoned line as a branch instead of deleting it. Session-scoped and memory-budgeted |
| **Free Transform** | Resize, rotate, skew, perspective, and warp on any object |
| **Text Styling** | Bold, italic, underline, overline, and line-through, with the decoration line's own colour and thickness rather than the fill's |
| **Trace to Vector** | Converts a raster layer into editable paths with colour-count, smoothing, and detail controls; the source layer is hidden, not destroyed |
| **Gradient Stops** | Linear gradients expose draggable start and end handles on the canvas; the tool says so rather than half-working on radial gradients, which have no upstream control set |
| **Auto-Save** | Dirty project revisions are written to browser recovery storage every 30 seconds and cleared only after the storage path acknowledges the write |

### File I/O

| Format | Import | Export |
|--------|--------|--------|
| **PNG** | Yes | Yes |
| **JPEG** | Yes | Yes |
| **WebP** | Yes (animated frames with timing) | Yes |
| **APNG** | Yes (animated frames with timing) | — |
| **AVIF** | Yes (verified WASM decoder) | Yes (deterministic verified WASM encoder) |
| **SVG** | Yes (editable shapes, text, and groups — not rasterized) | Yes |
| **Vector PDF** | — | Yes (real path operators when no raster layer is visible) |
| **PDF** | Yes (page per layer) | Yes |
| **PSD** | Yes (pixel layers, nested groups, supported blends, opacity, visibility, basic text) | Yes (same supported semantics; explicit raster fallbacks) |
| **GIF** | Yes (animated, frame-based) | Yes (animated, frame-based) |
| **OpenShop Project (`.openshop` / legacy `.json`)** | Yes | Yes (full project with layers) |

Batch export to multiple formats in one click. Export Settings previews PNG/WebP/AVIF alpha or the chosen matte, disables alpha for JPEG, and lists project features that the selected format cannot preserve. Exporting never marks the editable project as saved. Native save/open dialogs are available on Chrome/Edge via File System Access API.

### AI Features (Client-Side, via Transformers.js 4.2)

| Feature | Description |
|---------|-------------|
| **Background Removal** | MODNet-based automatic background removal |
| **Depth Map** | Depth-Anything monocular depth estimation |
| **Object Detection** | DETR-based object detection with bounding boxes |
| **Segment Select** | Click-guided subject masks via pinned SlimSAM |
| **Enlarge (AI model)** | Swin2SR super-resolution at 2x or 4x, run tile by tile with progress and cancellation |

All AI models download once and run entirely in-browser. Before the first download, OpenShop uses Transformers.js 4.2's model registry to report the exact transfer and installed sizes. It probes for a usable WebGPU adapter and falls back to WASM; the verified WASM engine is cached separately so the hosted app can reuse it offline after one online run. No API keys or image uploads are involved. Model revisions are pinned to immutable commit SHAs: Segment Select uses Apache-2.0 `Xenova/slimsam-77-uniform`, Depth Map uses Apache-2.0 `onnx-community/depth-anything-v2-small`, and Background Removal stays on the permissively licensed MODNet rather than noncommercial or GPL alternatives; the AI enlarger uses Apache-2.0 `Xenova/swin2SR-classical-sr-x2-64` and `-x4-64`. Model loading, inference, and CPU post-processing expose one cancel action; late results are discarded if the document revision or target layer changes.

### Adjustments & Filters

Enlarge 2x/4x (stepped high-quality resampling with a sharpening pass; the Image menu lists it beside the model-backed AI enlarger and labels which is which), Levels, Curves (per-channel), Brightness/Contrast, Hue/Saturation, Color Balance, Auto Levels, Auto Enhance, Grayscale, Sepia, Invert, Black & White, Sharpen, Blur, Noise, Vignette, Posterize, Threshold, Emboss, Edge Detect, Pixelate, Oil Paint, Halftone, Duotone, Tilt Shift, Chromatic Aberration, Gradient Map, Vibrance, Exposure, Shadows/Highlights, Photo Filter, Selective Color, Replace Color, Lens Correction, and 8 built-in photo presets with custom preset import/export.

Heavy filters (Oil Paint, Tilt Shift, Unsharp Mask, Posterize, Threshold, Vignette, Edge Detect, Duotone, Chromatic Aberration) run in a Web Worker so the UI stays responsive on large images. Photon WASM is loaded on demand as an optional accelerator for supported pixel filters, with automatic fallback to the JavaScript worker. Cancel terminates the active filter worker, rejects its pending job, and leaves the source layer and history unchanged.

### Interface

| Feature | Description |
|---------|-------------|
| **Precision Studio UI** | High-contrast dark workspace with a floating tool dock, structured inspector cards, responsive local-first launcher, and default, midnight, and OLED variants |
| **Command Palette** | `Ctrl+K` to search and run any command |
| **Action Recorder** | Records validated, versioned edit commands and replays mixed actions atomically; a failed step rolls back the whole action |
| **Context Menus** | Right-click for contextual actions |
| **Rulers & Guides** | Draggable guides with snapping and pixel grid at high zoom |
| **Grid Overlay** | Toggleable composition grid |
| **Keyboard Shortcuts** | Full Photoshop-style shortcut set (40+ bindings) |
| **Marching Ants** | Animated selection borders |
| **Welcome Screen** | Template presets for common canvas sizes |
| **Tab Toggle** | `Tab` hides all panels for distraction-free editing |
| **Offline & Install** | The hosted HTTPS lane stages and verifies its complete core shell, supports install prompts, exposes cache/model state, and rolls back an update that cannot confirm startup; the one-file `file://` lane is explicitly network-first |
| **Accessibility** | ARIA roles, keyboard navigation, focus indicators, reduced-motion support, hidden canvas-state mirror, and live status announcements |
| **Save State** | The status bar and document title distinguish clean, unsaved, saving, saved, and failed writes; unload warnings follow actual dirty state |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command Palette |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / Cut / Paste |
| `Ctrl+J` | Duplicate Object |
| `Ctrl+A` | Select All |
| `Ctrl+D` | Deselect |
| `Ctrl+Shift+D` | Reselect |
| `Ctrl+Shift+I` | Inverse Selection |
| `Ctrl+T` | Free Transform |
| `Ctrl+E` | Merge Down |
| `Ctrl+S` | Save Project |
| `Ctrl+N` | New Document |
| `Ctrl+G` / `Ctrl+R` | Toggle Grid / Rulers |
| `Ctrl+0` / `Ctrl+1` | Zoom Fit / Zoom 100% |
| `Space` (hold) | Temporary Pan |
| `Tab` | Toggle UI Panels |
| `[ / ]` | Brush Size |
| `X` | Swap FG/BG Colors |
| `D` | Reset to Black/White |
| `V B E T G C Z H L R P M W S I J A N` | Tool shortcuts |

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  Single HTML File (~17,000 lines)                            │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐               │
│  │  CSS     │  │  HTML    │  │  JavaScript  │               │
│  │  Styles  │  │  Layout  │  │  Engine      │               │
│  └──────────┘  └──────────┘  └──────┬───────┘               │
│                                      │                       │
│       ┌──────────────────────────────┼──────────────┐        │
│       │                              │              │        │
│  ┌────▼─────┐  ┌─────────────┐  ┌───▼──────┐  ┌────▼─────┐ │
│  │ Fabric.js│  │ ag-psd      │  │ jsPDF    │  │Transformers│ │
│  │ Canvas   │  │ PSD I/O     │  │ PDF Out  │  │.js AI     │ │
│  └──────────┘  └─────────────┘  └──────────┘  └──────────┘  │
│                                                              │
│  Everything runs client-side. Zero server dependency.        │
└──────────────────────────────────────────────────────────────┘
```

### Dependencies (loaded via CDN with SRI integrity hashes)

| Library | Purpose |
|---------|---------|
| [Fabric.js 7.4.0](https://fabricjs.com/) | Canvas rendering, object manipulation, serialization |
| [Fabric.js 7.4.0 extensions](https://github.com/fabricjs/fabric.js/tree/master/extensions) | On-canvas linear gradient stop handles (loaded on demand) |
| [imagetracerjs 1.2.6](https://github.com/jankovicsandras/imagetracerjs) (Unlicense) | Raster-to-vector tracing (loaded on demand) |
| [svg2pdf.js 2.7.0](https://github.com/yWorks/svg2pdf.js) (MIT) | Vector PDF pages for all-vector documents (loaded on demand) |
| [ag-psd 31.0.2](https://github.com/Agamnentzar/ag-psd) | Photoshop PSD file import and export |
| [jsPDF 4.2.1](https://github.com/parallax/jsPDF) | PDF document generation |
| [Transformers.js 4.2](https://huggingface.co/docs/transformers.js) | Client-side AI inference via WebGPU/WASM (loaded on demand) |
| [Photon 0.3.3](https://github.com/silvia-odwyer/photon) | Optional WASM acceleration for supported pixel filters (loaded on demand) |
| [jSquash AVIF 2.1.1](https://github.com/jamsinclair/jSquash) (Apache-2.0) | Deterministic AVIF encode/decode via libavif WASM (loaded on demand) |
| [Google Fonts](https://fonts.google.com/) | JetBrains Mono + DM Sans |

OpenShop `.openshop` files are JSON-encoded document schema v1. The same envelope drives project save/open, recovery, and undo/redo so layer membership and order, masks, guides, selections, animation frames, and active state stay synchronized. Legacy `.json`, Fabric 5, and OpenShop 0.18.13 projects are migrated on load.

Recovery uses checksum-verified, immutable generations keyed by stable document IDs rather than one overwrite-in-place file. Writes stage and verify a temporary OPFS file before promotion, retain up to five generations per document, rebuild from snapshot files if the index is damaged, and fall back to the newest verified older generation when necessary. Web Locks serialize the shared index and active tab leases fork competing documents into separate recovery streams. Recovery Storage shows quota and durable/best-effort status and supports metadata preview, naming, export, restore, open-as-copy, and per-generation discard. The legacy singleton autosave migrates on first supported startup.

## Embedding OpenShop

A host page can drive OpenShop in an iframe over a versioned `postMessage` contract. Nothing in it carries code — every message is data, and the editor answers only the window that completed the handshake.

**Protocol version 1.** Every message in both directions carries `version: 1`; a message with any other version is answered with `openshop:error` rather than guessed at.

| Host → OpenShop | Payload | Reply |
|---|---|---|
| `openshop:hello` | — | `openshop:ready` with `capabilities: { exportFormats, tools, overrides }` |
| `openshop:configure` | `document`, `tools`, `overrides` | `openshop:configured` with the tool list and overrides in force |
| `openshop:export` | `format`, `options` | `openshop:exported` with `{ blob, filename, format }` |
| `openshop:open` | `document` | `openshop:opened` |

| OpenShop → Host | When |
|---|---|
| `openshop:ready` | Once at startup with no `id` (so a host that missed the load event can still start), then again as the reply to `hello` |
| `openshop:save-requested` | The user saved and the host took `overrides.save`; carries `{ blob, filename }` |
| `openshop:open-requested` | The user chose Open and the host took `overrides.open` |
| `openshop:error` | `{ id, message }` for anything refused |

`document` is either `{ width, height, background }` or `{ dataUrl | blob, name }`. `tools` is an allowlist of `data-tool` values; anything outside it is hidden and removed from the tab order. Export formats are `png`, `jpeg`, `webp`, `avif`, `svg`, and `pdf`.

```html
<iframe id="editor" src="/openshop/index.html" width="1200" height="800"></iframe>
<script>
  const frame = document.getElementById('editor');
  const send = (message) => frame.contentWindow.postMessage({ version: 1, ...message }, '*');

  window.addEventListener('message', async (event) => {
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    if (message?.version !== 1) return;

    if (message.type === 'openshop:ready' && !message.id) {
      send({ type: 'openshop:hello', id: 'hello' });
    }
    if (message.type === 'openshop:ready' && message.id === 'hello') {
      send({
        type: 'openshop:configure',
        id: 'setup',
        document: { width: 1200, height: 630, background: '#101820' },
        tools: ['select', 'brush', 'text', 'crop'],
        overrides: { open: true, save: true }
      });
    }
    if (message.type === 'openshop:open-requested') {
      const blob = await fetch('/assets/banner.png').then(response => response.blob());
      send({ type: 'openshop:open', id: 'open', document: { blob, name: 'banner.png' } });
    }
    if (message.type === 'openshop:save-requested') {
      await fetch('/api/artwork', { method: 'POST', body: message.blob });
    }
    if (message.type === 'openshop:exported') {
      console.log('got', message.filename, message.blob.size, 'bytes');
    }
    if (message.type === 'openshop:error') {
      console.warn('openshop refused', message.id, message.message);
    }
  });

  // Ask for the finished artwork whenever the host is ready for it.
  document.getElementById('done')?.addEventListener('click', () => {
    send({ type: 'openshop:export', id: 'final', format: 'png', options: { scale: 2 } });
  });
</script>
```

Serve OpenShop over http(s) rather than `file://` when embedding. A `file://` document reports its origin as the literal string `null`, which `postMessage` cannot be given as a target — the editor falls back to `'*'` for its replies in that case, so the handshake still works for local testing but the replies are not origin-restricted. The editor always binds to the exact window that sent `openshop:hello` and ignores every other one.

## Privacy and Network Use

OpenShop has no account, no credit meter, no telemetry, and no upload path. Every edit, filter, export, and AI inference runs in your browser on your machine. There is no server-side component to send a document to, so no document, layer, selection, or pixel is ever transmitted.

What OpenShop *does* fetch is program code — and, the first time you use an AI feature, that model's weights:

| Host | What comes from it | When |
|---|---|---|
| `cdn.jsdelivr.net` | Pinned, SHA-384-verified libraries and codecs (Fabric, ag-psd, jsPDF, Photon, GIF, AVIF, Transformers.js, ONNX Runtime) | Three at startup; the rest only when a feature that needs them is used |
| `huggingface.co` / `*.hf.co` | Pinned AI model weights | First use of a given AI feature |
| `fonts.googleapis.com` / `fonts.gstatic.com` | JetBrains Mono and DM Sans | Page load |

You do not have to take that on trust. **The status bar reports outbound requests where a hosted competitor shows remaining credits.** It reads `Nothing sent` until something is fetched, then names the count; clicking it opens **Network Activity**, which lists every request this session grouped by host and purpose. The ledger is installed before the first fetch in the document, so the three startup libraries are on the list too.

**Strict offline mode** — the same dialog, or `Toggle Strict Offline Mode` in the command palette — refuses every request to anywhere but this page unless it is already cached. It disables whichever lazily fetched capabilities have not been downloaded yet, and the dialog names them individually rather than warning in the abstract. The preference persists across reloads.

One honest limitation: on the standalone `file://` lane a cold start needs the three pinned libraries, which *are* the application. If strict mode is on and nothing is cached, OpenShop stands the mode down, opens anyway, and reports why in the Network Activity dialog rather than leaving you with no interface to turn it off. To hold the guarantee across a cold start, use the hosted lane described under [Self-Hosting](#self-hosting), where those libraries are part of the verified offline shell — the same subdirectory bundle a school or clinic can serve from its own network.

## Security

- Core startup CDN scripts are version-pinned and loaded with [Subresource Integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hashes
- PSD, Photon, GIF, AVIF, Transformers.js, and ONNX lazy runtime bytes are version-pinned, SHA-384 verified before execution, and discarded on any digest mismatch
- Static controls carry opaque action IDs resolved by a frozen listener registry; executable HTML event attributes are forbidden by the release security check
- Recent files, saved palettes, templates, and photo presets render through DOM APIs so persisted values remain inert text
- Worker-backed filters use a named operation registry, so filter jobs no longer pass executable source strings or require `unsafe-eval`
- Command palette, context menu, sticky notes, animation frames, macro list, AI progress titles, and save-preset modals render through DOM APIs instead of runtime `innerHTML`
- PSD import performs its complete ag-psd decode in a cancellable worker, enforces file/header/layer bounds plus a 256 MB aggregate decoded-pixel ceiling, and commits the new document only after every layer is ready
- Project, palette, preset, and image imports share central schema/resource budgets for dimensions, file sizes, object counts, color formats, and adjustment ranges
- Recovery Storage in the command palette exposes checksum-verified per-document generations, corruption fallback, active-tab ownership, quota/durability, naming, preview, restore/open-as-copy, export, and discard actions
- The script policy uses exact SHA-256 hashes for the two reviewed inline scripts and permits neither `unsafe-inline` nor unrestricted `unsafe-eval`; `wasm-unsafe-eval` is retained only for digest-verified WebAssembly
- AI model revisions pinned to immutable commit SHAs (not mutable branch refs)
- PSD layer names and project JSON are sanitized to prevent XSS injection
- SVG export is sanitized to strip script tags and event handlers
- jsPDF upgraded to 4.2.1 to patch CVE-2026-25755

The portable `file://` lane enforces the policy embedded in `index.html`; because it has no response headers, it cannot emit violation reports. Hosted deployments retain that baseline and should copy the generated policy into an HTTP `Content-Security-Policy` header. Test stricter policies with `Content-Security-Policy-Report-Only` and a deployment-owned reporting endpoint before enforcing them. After any inline script edit, run `npm run security:write`; `npm run security:check` rejects stale hashes, executable event attributes, undeclared UI actions, unverified external scripts, and lazy executable paths that bypass the digest manifest.

## Offline, Install, and File Launch

OpenShop has two explicit distribution contracts:

- `index.html` opened from disk remains the portable one-file editor. Core libraries are pinned but CDN-hosted, so a cold launch and any uncached optional helper require a connection. Browsers do not allow this lane to register a service worker.
- An HTTPS or localhost deployment that includes `sw.js`, `manifest.webmanifest`, `icon-192.png`, and `icon-512.png` stages the editor, manifest, icons, Fabric, ag-psd, and jsPDF as one verified shell. The status bar reports readiness. Once ready, the core editor reloads offline.

Hosted updates install into a separate cache and remain waiting until applied. The new shell must complete an editor health check; if it does not, the next launch returns to the last verified shell. The Offline & Install dialog exposes update, rollback, connection, install, optional-helper, and pinned AI-model cache state.

Installed-app file launch is progressively enhanced through `launchQueue`. Supporting desktop Chromium releases can launch PNG, JPEG, WebP, GIF, PSD, and `.openshop` project files; other browsers retain Open, drag/drop, and file-picker workflows. AI models are intentionally outside the core shell and require one successful online use before their own cache can help offline.

## Self-Hosting

```bash
# Portable, network-first standalone
cp index.html /var/www/html/index.html

# Hosted offline/install lane, scoped to one application directory
mkdir -p /var/www/html/openshop
cp index.html sw.js manifest.webmanifest icon-192.png icon-512.png /var/www/html/openshop/

# Or with GitHub Pages
git init && git add . && git commit -m "init"
# Enable Pages in repo settings → serves as a live editor
```

No build step. No bundler. No runtime `node_modules`. `index.html` remains usable by itself; the four static companions enable the hosted PWA contract.

Keep those five hosted files together in their own directory. A service worker's default scope is the directory containing `sw.js`; placing it at `/sw.js` grants it navigation control over every path on that origin. GitHub project Pages sites such as `/Openshop/` already provide the desired directory scope. A user/organization Pages site served at the origin root should publish OpenShop below a subdirectory instead.

## Testing

The app still ships as a single HTML file. The Node tooling is only for local contributor verification:

```bash
npm install
npm test
npm run test:e2e
npm run test:release
```

`npm test` runs Vitest unit coverage for the core editor object with canvas mocks. `npm run test:e2e` runs Playwright against `index.html`, including onboarding and dialog checks at 320×568, 375×667, 768×1024, and their landscape equivalents.
`npm run test:release` adds a high/critical advisory gate before running both suites.

## Browser Support

| Browser | Status | Evidence |
|---------|--------|----------|
| Chrome / Edge 90+ | Full support (including AI via WebGPU) | Full automated suite runs on every change |
| Firefox 90+ | Core editing supported (AI via WASM fallback). No File System Access API, so Open uses the file picker and Save Project downloads rather than writing in place | Open, edit, filter, save, recover, export, keyboard and dialog flows run automatically, plus a capability probe asserting each fallback |
| Safari 15+ / WebKit | Core editing supported (AI via WASM fallback, auto-save via Worker). Opening the single HTML file directly gives no auto-save or crash recovery — WebKit exposes no origin-private file system to a `file://` origin, so host it to get them | Same automated flows run on WebKit, including a per-engine capability probe; not yet verified on Safari hardware |
| Mobile Chrome/Safari | Responsive shell and dialogs; precision canvas work is best on a larger display | Viewport tests only; not verified on a physical device |

Run the cross-engine flows yourself with `npm run test:cross-browser`.

Offline installation depends on service-worker/PWA support. Operating-system file associations are currently a desktop Chromium capability; OpenShop feature-detects them and does not claim them in Firefox or Safari.

## Related Tools

| Tool | Type | Best For |
|------|------|----------|
| **OpenShop** (this repo) | Single-file browser app + optional hosted PWA | Zero-install editing — 34 tools, PSD import/export, client-side AI, and verified hosted-shell offline reloads |
| [PyShop](https://github.com/SysAdminDoc/PyShop) | Python desktop app | Native desktop image editor if you prefer a traditional installed application |

## FAQ

**Q: Is this really just one HTML file?**
Yes. All CSS, HTML, and JavaScript are in a single self-contained file. External resources are limited to CDN-hosted libraries (loaded with integrity hashes) and fonts.

**Q: Do my images get uploaded anywhere?**
No. Everything runs in your browser. Images are processed locally via Canvas API and never leave your machine. AI models are downloaded once to your browser cache and run client-side.

**Q: Can I use this offline?**
The answer depends on how OpenShop is launched. A downloaded `index.html` is network-first because its pinned core libraries come from CDNs. The hosted HTTPS build becomes offline-ready only after its status indicator says **Offline ready**; its service worker then serves the verified core shell and can fall back after a bad update. Optional Photon/GIF helpers and AI models work offline only when their resources were previously cached, and the Offline & Install dialog reports the state it can verify.

**Q: How does PSD import/export work?**
OpenShop uses ag-psd to parse and write `.psd` files client-side. Import decoding runs in a worker with explicit resource limits and a cancel action, so a rejected import leaves the open document unchanged. Drawable layer files import without duplicating Photoshop's document composite. Nested group metadata, supported blend modes, opacity, visibility, locks, and single-style horizontal text survive PSD import → export → reimport. Group compositing is approximated while editing but its metadata is retained for PSD export.

OpenShop shows a compatibility report whenever exact semantics are unavailable. Layer effects, masks, adjustment layers, clipping relationships, and separate fill opacity use the document composite as one flattened appearance layer. Smart objects, vector content, and rich text use per-layer decoded-pixel fallbacks. OpenShop masks and pixel filters are baked into exported PSD layer pixels; mixed-content text and vector objects are rasterized. The editable OpenShop project format is the lossless choice for OpenShop-only history, selections, guides, animation, and object structure.

**Q: Why not React/Vue/Svelte?**
Simplicity. A single HTML file can be hosted anywhere, shared as an email attachment, opened from a USB drive, or embedded in any environment. No build toolchain means zero maintenance burden.

## Contributing

Issues and PRs welcome. The codebase is a single file — just open `index.html` in any editor.

When contributing:
- Run `npm test` and `npm run test:e2e`; run `npm run test:cross-browser` before changing anything the browser-support table claims
- Maintain the single-file architecture
- Keep the dark theme consistent with existing CSS variables
- Route replayable edits through a schema-v1 command and one history transaction; use `saveHistory()` only for a completed synchronous mutation
- Heavy pixel operations should use `_runFilterInWorker()` to avoid blocking the UI

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**OpenShop** is built by the community for the community. No accounts, no tracking, no paywalls. Just open and edit.
