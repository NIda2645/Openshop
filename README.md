# OpenShop

![Version](https://img.shields.io/badge/version-0.20.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Browser-orange)
![Zero Install](https://img.shields.io/badge/install-none_required-brightgreen)
![Single File](https://img.shields.io/badge/single_file-HTML-E34F26?logo=html5&logoColor=white)

> A free, single-file browser-based image editor with layers, AI tools, pixel-level selections, filters, PSD import/export, and a Photoshop-inspired workflow. No server, no signup, no install.

## Try It Now

**[Open OpenShop in your browser](https://sysadmindoc.github.io/Openshop/)** — no download required.

Or download `index.html` and open it locally. Everything runs client-side. Your images never leave your machine.

## Quick Start

1. Visit **https://sysadmindoc.github.io/Openshop/**
2. Or download the single HTML file and open it in any modern browser (network is required for a cold standalone launch)
3. Start editing

**Self-host it** — deploy the static files to GitHub Pages, Netlify, S3, or Nginx. There is no build step, bundler, or runtime `node_modules`; include the PWA companions described below if you want verified offline reloads and installation.

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
| **Free Transform** | Resize, rotate, skew, perspective, and warp on any object |
| **Auto-Save** | Dirty project revisions are written to browser recovery storage every 30 seconds and cleared only after the storage path acknowledges the write |

### File I/O

| Format | Import | Export |
|--------|--------|--------|
| **PNG** | Yes | Yes |
| **JPEG** | Yes | Yes |
| **WebP** | Yes | Yes |
| **SVG** | — | Yes |
| **PDF** | — | Yes |
| **PSD** | Yes (pixel layers, nested groups, supported blends, opacity, visibility, basic text) | Yes (same supported semantics; explicit raster fallbacks) |
| **GIF** | — | Yes (animated, frame-based) |
| **OpenShop Project (`.openshop` / legacy `.json`)** | Yes | Yes (full project with layers) |

Batch export to multiple formats in one click. Export Settings previews real PNG/WebP alpha or the chosen matte, disables alpha for JPEG, and lists project features that the selected format cannot preserve. Exporting never marks the editable project as saved. Native save/open dialogs are available on Chrome/Edge via File System Access API.

### AI Features (Client-Side, via Transformers.js 4.0)

| Feature | Description |
|---------|-------------|
| **Background Removal** | MODNet-based automatic background removal |
| **Depth Map** | Depth-Anything monocular depth estimation |
| **Object Detection** | DETR-based object detection with bounding boxes |
| **Segment Select** | Click-to-segment pixel selections via pinned DETR panoptic segmentation |
| **Smart Upscale** | 2x / 4x AI super-resolution |

All AI models download once and run entirely in-browser via WebGPU/WASM. No API keys, no server calls. Model revisions are pinned to immutable commit SHAs for supply-chain security. Segment Select uses `Xenova/detr-resnet-50-panoptic`; SAM-style mask-generation is not available in current Transformers.js browser pipelines.

### Adjustments & Filters

Levels, Curves (per-channel), Brightness/Contrast, Hue/Saturation, Color Balance, Auto Levels, Auto Enhance, Grayscale, Sepia, Invert, Black & White, Sharpen, Blur, Noise, Vignette, Posterize, Threshold, Emboss, Edge Detect, Pixelate, Oil Paint, Halftone, Duotone, Tilt Shift, Chromatic Aberration, Gradient Map, Vibrance, Exposure, Shadows/Highlights, Photo Filter, Selective Color, Replace Color, Lens Correction, and 8 built-in photo presets with custom preset import/export.

Heavy filters (Oil Paint, Tilt Shift, Unsharp Mask, Posterize, Threshold, Vignette, Edge Detect, Duotone, Chromatic Aberration) run in a Web Worker so the UI stays responsive on large images. Photon WASM is loaded on demand as an optional accelerator for supported pixel filters, with automatic fallback to the JavaScript worker.

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
│  Single HTML File (~7,300 lines)                             │
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
| [ag-psd 22.0.2](https://github.com/Agamnentzar/ag-psd) | Photoshop PSD file import and export |
| [jsPDF 4.2.1](https://github.com/parallax/jsPDF) | PDF document generation |
| [Transformers.js 4.0](https://huggingface.co/docs/transformers.js) | Client-side AI inference via WebGPU/WASM (loaded on demand) |
| [Photon 0.3.3](https://github.com/silvia-odwyer/photon) | Optional WASM acceleration for supported pixel filters (loaded on demand) |
| [Google Fonts](https://fonts.google.com/) | JetBrains Mono + DM Sans |

OpenShop `.openshop` files are JSON-encoded document schema v1. The same envelope drives project save/open, recovery, and undo/redo so layer membership and order, masks, guides, selections, animation frames, and active state stay synchronized. Legacy `.json`, Fabric 5, and OpenShop 0.18.13 projects are migrated on load.

Recovery uses checksum-verified, immutable generations keyed by stable document IDs rather than one overwrite-in-place file. Writes stage and verify a temporary OPFS file before promotion, retain up to five generations per document, rebuild from snapshot files if the index is damaged, and fall back to the newest verified older generation when necessary. Web Locks serialize the shared index and active tab leases fork competing documents into separate recovery streams. Recovery Storage shows quota and durable/best-effort status and supports metadata preview, naming, export, restore, open-as-copy, and per-generation discard. The legacy singleton autosave migrates on first supported startup.

## Security

- Core startup CDN scripts are version-pinned and loaded with [Subresource Integrity (SRI)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hashes
- PSD, Photon, GIF, Transformers.js, and ONNX lazy runtime bytes are version-pinned, SHA-384 verified before execution, and discarded on any digest mismatch
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

# Hosted offline/install lane
cp index.html sw.js manifest.webmanifest icon-192.png icon-512.png /var/www/html/

# Or with GitHub Pages
git init && git add . && git commit -m "init"
# Enable Pages in repo settings → serves as a live editor
```

No build step. No bundler. No runtime `node_modules`. `index.html` remains usable by itself; the four static companions enable the hosted PWA contract.

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

| Browser | Status |
|---------|--------|
| Chrome / Edge 90+ | Full support (including AI via WebGPU) |
| Firefox 90+ | Full support (AI via WASM fallback) |
| Safari 15+ | Full support (AI via WASM fallback, auto-save via Worker) |
| Mobile Chrome/Safari | Responsive shell and dialogs; precision canvas work is best on a larger display |

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
- Test in Chrome and Firefox at minimum
- Maintain the single-file architecture
- Keep the dark theme consistent with existing CSS variables
- Route replayable edits through a schema-v1 command and one history transaction; use `saveHistory()` only for a completed synchronous mutation
- Heavy pixel operations should use `_runFilterInWorker()` to avoid blocking the UI

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**OpenShop** is built by the community for the community. No accounts, no tracking, no paywalls. Just open and edit.
