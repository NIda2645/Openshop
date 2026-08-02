# OpenShop Roadmap

Single-file browser image editor with layers, PSD import, and client-side AI. Roadmap targets staying turnkey while expanding pro-grade editing and export fidelity.

The complete live-Photoshop parity work breakdown is in
PHOTOSHOP_PARITY_ROADMAP.md. It is derived from the Photoshop CS6 audit under
windows-app-audit and is the implementation sequence for the audited shell, tools,
menus, panels, document semantics, accessibility, persistence, performance, and
testing gates.

## Planned Features

### Format & I/O
### Editor Core

### AI / ML (Transformers.js)

### Performance

## Competitive Research
- **Photopea** — closest peer; strong PSD parity and SVG editing. Lesson: invest in SVG-as-layers and smart-object fidelity.
- **Pixlr E / X** — cloud-assisted AI generative workflows; forces account gating. Lesson: keep AI local, make it the differentiator.
- **miniPaint** — tiny single-file editor, weak on layers/AI. Lesson: OpenShop's AI + PSD import + single-file combo is a real gap they leave open.
- **Krita (desktop)** — best-in-class brush engine and color management. Lesson: borrow the brush preset format, borrow ICC profile handling for print users.
- **Graphite** (26.7k★, Apache-2.0, added 2026-07-31) — Rust/`wgpu` node-graph editor, the only genuine leapfrog threat. Lesson: the layer panel can be a *projection of a node graph*, and undo can be a graph diff instead of a pixel snapshot. Counter-lesson: they have deferred raster/photo tooling to Beta 2 and PSD to LTS, so the "parametric photo editor with PSD round-trip" intersection is currently unoccupied by anyone.
- **Photopea has shipped nothing since 5.6 (Sep 2024)** — verified 2026-07-31, blog dormant ~22 months. The free incumbent has stalled; its users' loudest complaints (ads eating canvas width, anti-adblock lockout, COPPA-driven school bans) are all things OpenShop already avoids by construction and never advertises.

## Nice-to-Haves

## Open-Source Research (Round 2)

### Related OSS Projects
- https://github.com/viliusle/miniPaint — Single-file browser image editor, layers/filters, closest conceptual peer. MIT.
- https://github.com/nhn/tui.image-editor — NHN Cloud Canvas editor, React/Vue wrappers, rich filter set.
- https://github.com/igorski/bitmappery — Vue/Vuex non-destructive web photo editor with PSD I/O.
- https://github.com/OliverBalfour/SimplePaint — HTML5 canvas editor with stylus/tablet support and Photoshop-style brushes.
- https://github.com/geeeeeeeek/freePS — Single-file HTML5 layer-based editor.
- https://github.com/mattketmo/darkroomjs — Fabric.js-backed pluggable image editor core.
- https://github.com/aurbano/nuophoto — Minimal browser editor, good reference for small-footprint adjustments.
- https://github.com/excalidraw/excalidraw — Not a raster editor but best-in-class canvas interaction patterns.

### Features to Borrow
- Non-destructive adjustment layers (BitMappery) — curves/levels/HSL as editable nodes, not baked pixels.
- Tablet/stylus pressure curves + Photoshop-style custom brush dynamics (SimplePaint).
- Plugin architecture for tools and filters (DarkroomJS) — lets third parties ship `.js` tool packs.
- Full-featured filter set: grayscale, emboss, tint, multiply, blend modes w/ WebGL (tui.image-editor).
- Complete UI/canvas-text localization and RTL behavior (BitMappery/miniPaint) — the shipped locale map is only partial.
- PSD semantic round-trip (BitMappery) — current import/export exists but does not preserve hierarchy and blend semantics reliably.
- Clipboard paste + URL/data-URL/drag-drop open paths (miniPaint).
- JSON scene export format for reopening layered work (miniPaint).

### Patterns & Architectures Worth Studying
- **Fabric.js canvas abstraction** (DarkroomJS) — sprite/object model for non-destructive transforms vs raw ImageData.
- **OffscreenCanvas + Worker filter pipeline** (tui.image-editor) — keeps >4K images responsive.
- **Plugin registration API** (DarkroomJS) — each tool is `plugin.register(editor)` with lifecycle hooks.
- **Vuex-style state store for history/undo** (BitMappery) — time-travel debugging, branch histories.
- **WebGL shader-based color adjustments** (BitMappery) — real-time sliders without CPU re-composite.

## Research-Driven Additions

### P0 — Release and trust

### P1 — Trust, accessibility, and interoperability

- [ ] P1 — Add versioned document migrations and structured loss reports
  Why: The project has schema version 1 and rejects newer schemas, while PSD support is constrained by ag-psd and ICC data is retained without conversion; users need predictable upgrades and an explicit account of what did not round-trip.
  Evidence: `index.html` `_documentSchemaVersion`, `_historySchemaVersion`, `_commandSchemaVersion`, `_sanitizeProjectJSON()`; `README.md` OpenShop/ICC notes; [ag-psd format limitations](https://www.npmjs.com/package/ag-psd).
  Touches: `index.html`, import/export code, fixture files, unit tests, `README.md`.
  Acceptance: A migration registry handles every supported schema version and rejects unknown future versions without mutating the active document; PSD/OpenShop import and export return a structured loss report naming unsupported color modes, fields, metadata, and approximations; fixtures cover migration rollback and malformed input.
  Complexity: M

- [ ] P1 — Make WebRTC collaboration revision-safe and peer-identifiable
  Why: Collaboration currently debounces and sends bounded full-document state over unauthenticated peer connections, so concurrent edits can overwrite each other and users cannot verify who is connected or recover a dropped session.
  Evidence: `index.html` collaboration code (`_collabProtocolVersion`, 32 MiB state cap, 180 KiB chunks, `iceServers: []`); `README.md` manual offer/answer workflow; [Figma multiplayer architecture](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) and [reliability design](https://www.figma.com/blog/making-multiplayer-more-reliable/).
  Touches: `index.html`, collaboration unit/e2e tests, `README.md`.
  Acceptance: Messages carry session/document/peer identity, monotonic revision and replay protection; concurrent layer/property edits converge deterministically or surface an explicit conflict; the UI shows peer fingerprint/consent, connection state, stale-message rejection, reconnect queue, and restore path; no pixel or document data leaves the selected peers.
  Complexity: L

- [ ] P1 — Synchronize version, browser-support, and release documentation
  Why: `CLAUDE.md` still identifies v0.27.0 while the package, manifest, shell, README, source, and changelog identify v0.28.0; the support table also distinguishes desktop breadth from unverified physical mobile coverage but has no automated consistency check.
  Evidence: `CLAUDE.md`, `package.json`, `manifest.webmanifest`, `README.md`, `index.html`, `sw.js`, and `CHANGELOG.md`.
  Touches: version-bearing files, `tests/os-unit.test.js`, release tooling.
  Acceptance: A release test validates every user-facing version and shell revision against one source of truth and fails with the stale path; the support matrix explicitly separates browser engine, `file://`/hosted mode, viewport emulation, physical mobile, pen input, and offline claims; release notes describe verified limits and migration behavior.
  Complexity: S

### P2 — Performance, mobile, extensibility, and workflow depth

- [ ] P2 — Publish measured large-document performance and memory budgets
  Why: Tiled history, GPU filters, import size caps, and worker fallbacks exist, but their limits are static policy rather than measured budgets; large canvas memory and region-update behavior are known browser failure modes.
  Evidence: `index.html` import/history/filter limits and diagnostics; PS-060/PS-061/PS-062; [OffscreenCanvas guidance](https://web.dev/articles/offscreen-canvas?hl=en); [Krita 2026 roadmap](https://krita.org/en/posts/2026/roadmap-2026/); large-canvas memory reports [1](https://stackoverflow.com/questions/70796250/how-can-i-optimize-html-canvas-and-javascript-to-handle-large-sized-images-for-a) and [2](https://stackoverflow.com/questions/38463081/large-image-copy-to-canvas-causes-large-memory-usage).
  Touches: benchmark fixtures/tools, `index.html` diagnostics and render pipeline, CI, `README.md`.
  Acceptance: Deterministic 4K/8K/12MP fixtures benchmark import, paint, filter preview/apply, undo/redo, export, and batch; results record p50/p95 latency, peak/retained memory, worker/GPU/CPU path, cancellation, and stale-result handling; documented thresholds gate releases without claiming unsupported ceilings.
  Complexity: M

- [ ] P2 — Validate mobile and stylus on capability matrices
  Why: Mobile workspace and pressure-aware input were added in the 2026-08-02 release, but README support is viewport-only and physical-device behavior is explicitly unverified.
  Evidence: `README.md` browser/support table, `index.html` responsive and `PointerEvent.pressure` paths; [MDN PointerEvent pressure](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pressure); miniPaint phone issue and [Krita tablet roadmap](https://krita.org/en/posts/2026/roadmap-2026/).
  Touches: mobile Playwright projects, capability diagnostics, pointer/input code, `README.md`.
  Acceptance: Chromium/Firefox/WebKit emulation plus documented physical Android/iOS/Windows-pen checks cover pressure varying/constant, touch pan/pinch, safe-area, virtual keyboard, rotation, import/export, recovery, and offline start; support claims are limited to observed matrices.
  Complexity: M

- [ ] P2 — Give plugins an installable manifest, consent, and provenance contract
  Why: The sandbox API has capability and token checks, but runtime source registration has no stable identity, persistence, provenance, review screen, or lifecycle contract.
  Evidence: `index.html` plugin registry and `plugin-sandbox.js`; [Penpot plugin/API model](https://github.com/penpot/penpot) and [self-hosting/privacy model](https://penpot.app/self-host); existing sandbox-security tests.
  Touches: `index.html`, `plugin-sandbox.js`, plugin tests, `README.md`.
  Acceptance: A manifest defines stable id/version/name/source hash/capabilities/minimum API; explicit consent precedes load; allow/remove state persists; incompatible or changed-hash plugins are rejected; network, file, DOM, and document-write access remain deny-by-default; disposal removes commands and listeners.
  Complexity: L

- [ ] P2 — Make batch processing cancellable, worker-friendly, and format-honest
  Why: The batch path caps files and bytes but runs ZIP/output work on the main thread, exposes no user cancel/progress surface, and accepts only raster inputs despite broader editor import support.
  Evidence: `index.html` batch processor, `README.md` format matrix; [Filerobot editor export/history features](https://github.com/scaleflex/filerobot-image-editor); [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) and [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext).
  Touches: `index.html`, batch unit/e2e tests, worker code if needed, `README.md`.
  Acceptance: UI reports per-file and aggregate progress, supports cancellation and partial-failure recovery, leaves the open document unchanged on cancel, and yields or workers ZIP generation; input/output compatibility is explicit; tests cover size/file caps, duplicate names, malformed recipes, cancel, and one bad file among valid files.
  Complexity: L

- [ ] P2 — Render supported ABR tips as real raster brush stamps
  Why: The current ABR path preserves selectable preset metadata but README calls it the closest native stroke adapter; brush appearance is therefore not yet a faithful round-trip.
  Evidence: `README.md` ABR note, `index.html` ABR import/brush code, and [Aseprite brush documentation](https://www.aseprite.org/docs/brushes/).
  Touches: `index.html` brush engine and persistence, ABR fixtures, unit/e2e tests, `README.md`.
  Acceptance: Supported ABR tip textures, spacing, size, opacity, scatter, and pressure dynamics produce pixel-stamped strokes; unsupported features are reported by name; bounded fixtures test deterministic output, memory limits, and reopening the saved document.
  Complexity: L
