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
