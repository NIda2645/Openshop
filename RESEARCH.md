# Research — OpenShop
Date: 2026-07-29 — replaces all prior research.
Confidence: Verified unless explicitly marked; community-only signal is Likely/anecdotal, and the Open Questions require a product-owner decision.

## Executive Summary

[Verified] OpenShop 0.20.0 is strongest as a private, zero-account image editor delivered in one HTML file: it already combines Fabric-based layers, broad pixel tools, PSD/GIF/project I/O, local recovery, and optional client-side AI. Its highest-value direction is not more surface area; it is making the existing editor trustworthy. The live implementation has competing document representations, lossy save/history paths, an unacknowledged autosave worker, a vulnerable Fabric release, unbounded aggregate PSD decode, broken narrow-screen onboarding, and offline/AI/format claims that exceed behavior. Preserve the single-file product philosophy while introducing internal document, command, persistence, compute, and compatibility boundaries.

Top opportunities, in priority order:

1. [Verified] Raise the existing Fabric 7.4+ migration to P0 and gate it with the two stored-XSS regressions.
2. [Verified] Establish one versioned document model shared by runtime layers, project files, recovery, and undo/redo.
3. [Verified] Make dirty/save/autosave transitions transactional and failure-tested.
4. [Verified] Bound aggregate PSD memory and move full decode off the UI thread.
5. [Verified—live Chromium validation] Make onboarding and every modal usable at 320–375 px widths.
6. [Verified] Replace label-based history/macros with versioned command transactions.
7. [Verified] Fix export transparency/loss handling and make PSD round-trips fidelity-tested.
8. [Verified] Add atomic recovery generations, cross-tab ownership, and explicit storage durability.
9. [Verified] Choose an honest standalone/hosted offline contract and reduce the executable dependency/CSP trust surface.
10. [Verified] Gate releases with cross-browser, accessibility, selection, localization, and capability-claim tests.

## Product Map

### Core workflows

- Open or drop raster/GIF/PSD files, create a canvas, or restore a local project.
- Edit Fabric objects and pixel layers with drawing, selection, transform, adjustment, filter, text, guide, and layer controls.
- Run optional worker/WASM filters and browser-local Transformers.js tools.
- Save project JSON or export raster, SVG, PDF, PSD, GIF, and batch format variants.
- Recover one OPFS autosave and expose local-storage surfaces for palettes, presets, locale, and recent-file metadata; several of those surfaces remain incomplete.

### User personas

- Privacy-sensitive users who cannot upload source images or create an account.
- Students, educators, support staff, and occasional editors needing a zero-install tool.
- Designers exchanging basic PSDs or producing quick web assets without a desktop suite.
- Developers embedding or self-hosting a compact editor; advanced print, prepress, and collaborative teams are not yet a credible primary persona.

### Platforms and distribution

- [Verified] One `index.html` is the runtime artifact; GitHub Pages is the linked hosted surface.
- [Verified] Chromium is the only automated browser on 2026-07-29; README claims Chrome/Edge, Firefox, and Safari support.
- [Verified] Responsive CSS exists, but the welcome flow and fixed-width dialogs fail at phone widths.
- [Verified] The generated manifest/CacheStorage code is not a functional install/offline/file-handler implementation without a service worker and `launchQueue` consumer.

### Key integrations and data flows

- Local file/clipboard/drop → validation → Fabric canvas and `OS.layers`.
- PSD → ag-psd preflight worker → second main-thread decode → Fabric objects.
- Canvas → history/project/autosave JSON; OPFS stores one overwrite-in-place recovery file.
- Canvas → Blob/File System Access/download exports; SVG is post-sanitized.
- CDN modules/models → Fabric, ag-psd, jsPDF, Photon, gif.js, and Transformers.js; only the three startup scripts carry SRI.

## Competitive Landscape

### Photopea

- Does well: real offline use, deep PSD/smart-object behavior, local backups, automation, and a self-hosting option.
- Learn: make fidelity, recovery, storage state, and disconnected behavior observable and testable.
- Avoid: exposing arbitrary scripting or chasing its format breadth before OpenShop’s document model is lossless.

### miniPaint

- Does well: compact browser delivery, familiar layers/filters, and a focused contributor surface.
- Learn: turn its reported undo/filter and Persian-text failures into OpenShop regression fixtures.
- Avoid: coupling UI lifecycle directly to history and renderer state.

### JS Paint

- Does well: approachable browser-native UX, session restoration, and alternative-input experimentation.
- Learn: isolate recovery by document/tab and persist every transient state that can destroy pixels.
- Avoid: speech/dwell features before keyboard, touch, contrast, and canvas interaction basics pass.

### Krita and GIMP 3

- Do well: explicit save/export/backups, mature non-destructive filters, versioned operations, and destructive “apply/merge” escape hatches.
- Learn: warn before flattening/loss and version any future adjustment/filter nodes.
- Avoid: importing a desktop binary plug-in architecture into the single-file trust boundary.

### Pixlr

- Does well: reusable batch macros over many files with ZIP output.
- Learn: typed deterministic commands must precede OpenShop’s existing batch-processor idea.
- Avoid: save-time restrictions and disruptive interaction redesigns; community reaction shows the trust cost.

### Photoshop Web and Sketch

- Do well: candid capability matrices, snapshots/version history, named versions, autosave, Trash, local ownership, and offline modes.
- Learn: recovery depth and honest limitations are product features, not housekeeping.
- Avoid: making cloud documents or subscriptions prerequisites for OpenShop’s core workflow.

### Figma, Excalidraw, and tldraw

- Do well: document/session separation, schema migrations, explicit history capture modes, cross-tab coordination, and recovery checkpoints.
- Learn: keep durable document state independent from camera, selection, and transient UI state.
- Avoid: adopting their framework/cloud architecture or licensed editor core; borrow contracts only.

### Canva

- Does well: treats offline editing and assistive-technology testing as major product investments.
- Learn: test real screen-reader, zoom, high-contrast, keyboard, and disconnected workflows.
- Avoid: stock libraries, brand/social suites, server AI credits, and commerce scope that dilute a local image editor.

## Security, Privacy, and Reliability

- [Verified] `index.html:14` loads Fabric 5.3.1, affected by CVE-2026-27013 and CVE-2026-44311. `_sanitizeProjectJSON()` and `_sanitizeSVG()` are useful defense-in-depth, but upstream fixes require Fabric 7.4.0+.
- [Verified] `npm audit --json` reports one high advisory on `postcss@8.5.15` through Vitest/Vite; `package-lock.json` also identifies the root as 0.18.12 while runtime/package metadata say 0.20.0.
- [Verified] `index.html:12` permits script `'unsafe-inline'`; static and generated event attributes remain, including `_filterModal()`. Dynamic Transformers, Photon, and gif.js code is neither startup-SRI-protected nor same-origin.
- [Verified] `_loadPSDFile()` preflights useful limits, then materializes the file and calls full `readPsd()` on the main thread. ag-psd recommends aggregate memory limits and staged/raw decode for untrusted files.
- [Verified] `saveProject()` clears dirty/recovery only on its download fallback; new/open operations can retain `_projectFileHandle`; `beforeunload` checks history position rather than saved state; the Safari worker path clears dirty without waiting for its reply.
- [Verified] project save records layer attributes without object membership, and open/history/recovery call `rebuildLayersFromCanvas()`, which collapses every object into one layer.
- [Verified] autosave overwrites one `openshop-autosave.json`; OPFS remains best-effort because persistence is never requested, and a corrupt newest snapshot has no older generation.
- [Verified] layer drag changes `OS.layers` but not Fabric z-order; selection can re-enable objects on locked layers; layer visibility/lock/opacity/rename are incompletely represented in history.
- [Verified] crop, flatten, and canvas rotate/flip rasterize through `createNewDocument()`, discarding layered undo context.
- [Verified] export settings read but ignore the transparency checkbox; SVG/PDF paths can include the checker boundary; temporary export mutations are not consistently restored with `finally`.

## Architecture Assessment

- [Verified] The root defect is split authority between Fabric objects, `OS.layers`, history JSON, `_openShop` metadata, animation frames, and autosave. Introduce a schema-versioned `DocumentState` and adapters; keep `index.html` as the shipped artifact.
- [Verified] Route mutations through typed, versioned commands with validated arguments, one transaction boundary, coalescing rules, and deterministic replay. This repairs undo, macros, async edits, and the existing batch roadmap dependency together.
- [Verified] Separate persistence into project, native-file, recovery, and download adapters sharing a `clean → dirty → saving → saved/error` state machine. Use per-document IDs, migrations, checksums, atomic generations, and cross-tab ownership.
- [Verified] Put PSD decode and long-running filters behind resource-budgeted worker protocols with job IDs, cancellation, stale-result rejection, and no partial document mutation.
- [Verified] Treat export as a reversible transaction with a capability/loss preflight. PSD golden fixtures must cover hierarchy, stacking, blend/opacity/visibility, text, transparency, and unsupported-feature warnings.
- [Verified] Pixel selections do not share one geometry model: lasso becomes a bounding box, feather discards fractional alpha, clipboard actions require an active object, and Magic Wand mixes viewport/document coordinates.
- [Verified] `playwright.config.js` exercises Chromium only. Missing contracts include multi-layer save/recovery, real PSD/GIF fixtures, animation/macro state, offline/file launch, OPFS failures, Firefox/WebKit, narrow welcome/dialogs, themes, RTL, and WCAG 2.2 interactions.
- [Verified] Version/docs drift is measurable: `index.html`/`package.json`/README say 0.20.0, the lock says 0.18.12, `CLAUDE.md` says 0.19.0, CHANGELOG stops at 0.19.1, and README’s line-count and WebGPU/offline/PSD claims are stale.
- [Verified] Several controls are capability façades: New Image background, Recent Files population, GPL/ASE palette parsing, preset capture/hue application, brush flow, Pen/“Perspective” semantics, animation playback/writeback, and multiple command IDs. Implement them or relabel/disable them; do not silently no-op.

## Rejected Ideas

- Mandatory accounts, cloud documents, or centralized sync — rejected; Figma/Adobe/Canva show the conflict and recovery burden, while local ownership is OpenShop’s differentiator.
- Near-term WebRTC collaboration — deferred despite the existing idea; conflict resolution, identity, and security are lower-value than preventing local data loss.
- Arbitrary remote plug-ins or a marketplace — rejected until a capability-scoped API, lifecycle cleanup, CSP, and immutable dependency policy exist.
- React/Vue/Vuex/tldraw-core rewrite — rejected; it adds runtime/build weight or licensing constraints without fixing the state contracts.
- Blanket WASM/WebGPU rewrite — rejected; published BitMappery results and browser-inference research show transfer/dispatch/memory costs can erase gains. Benchmark each workload.
- Browser-local SDXL/generative-fill priority — deferred; commercial parity is crowded and current browser inference already needs backend, cache, cancellation, memory, and honesty work.
- Full phone parity — rejected; ship a tested compact workflow and explicit limits before promising desktop equivalence.
- WebCodecs as a GIF encoder — rejected; it provides image decoding, not a generic GIF encoder. Benchmark a maintained encoder separately.
- PSB/CMYK/Lab/true-16-bit PSD parity through ag-psd — rejected as a near-term promise because upstream documents material format limits.
- Branding/logo work — rejected; repository history for `LOGO_PROMPTS.md` already removed mismatched branding artifacts, and no product-gap evidence supports revisiting it.

## Sources

### Open-source and adjacent editors

- https://github.com/viliusle/miniPaint
- https://github.com/viliusle/miniPaint/issues/424
- https://github.com/viliusle/miniPaint/issues/371
- https://github.com/1j01/jspaint
- https://github.com/1j01/jspaint/issues/101
- https://github.com/1j01/jspaint/issues/27
- https://github.com/nhn/tui.image-editor/issues/954
- https://github.com/igorski/bitmappery
- https://github.com/scaleflex/filerobot-image-editor
- https://github.com/aseprite/aseprite/issues/5770
- https://github.com/aseprite/aseprite/pull/5782
- https://www.gimp.org/news/2024/11/06/gimp-3-0-RC1-released/
- https://docs.krita.org/en/user_manual/autosave.html
- https://tldraw.dev/docs/persistence
- https://github.com/tldraw/tldraw
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
- https://github.com/chinaBerg/awesome-canvas/blob/main/README-EN.md

### Commercial products

- https://www.photopea.com/learn/
- https://www.photopea.com/tuts/photopea-opens-up-old-files/
- https://www.photopea.com/api/accounts
- https://pixlr.com/blog/automating-photo-edits-the-role-of-ai-in-batch-editing/
- https://www.canva.com/newsroom/news/canva-create-2026-launches/
- https://www.canva.com/accessibility/
- https://helpx.adobe.com/photoshop/web/get-set-up/learn-the-basics/compare-photoshop-web-and-desktop-features.html
- https://helpx.adobe.com/photoshop/web/get-set-up/learn-the-basics/view-and-restore-document-versions.html
- https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma
- https://www.sketch.com/docs/getting-started/saving-and-managing-documents/

### Community signal

- https://www.reddit.com/r/photopea/comments/1ibkduu
- https://www.reddit.com/r/pixlr/comments/1tnrugd/the_new_ui_update_is_garbage/
- https://www.reddit.com/r/Blind/comments/1qwo0ba/accessibility_of_design_softwares/
- https://news.ycombinator.com/item?id=18397380
- https://stackoverflow.com/questions/38463081/large-image-copy-to-canvas-using-drawimage-causes-large-memory-usage

### Standards and platform APIs

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- https://www.w3.org/TR/CSP/
- https://www.w3.org/TR/trusted-types/
- https://www.w3.org/TR/SRI/
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
- https://developer.chrome.com/docs/capabilities/web-apis/file-handling
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate
- https://www.w3.org/TR/pointerevents3/
- https://www.w3.org/TR/webcodecs/
- https://www.w3.org/TR/css-color-4/

### Dependencies, security, and engineering research

- https://fabricjs.com/docs/upgrading/upgrading-to-fabric-60/
- https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/
- https://github.com/fabricjs/fabric.js/releases
- https://github.com/advisories/GHSA-hfvx-25r5-qc3w
- https://github.com/fabricjs/fabric.js/security/advisories/GHSA-w22m-hvvm-xmwx
- https://github.com/advisories/GHSA-r28c-9q8g-f849
- https://github.com/Agamnentzar/ag-psd/blob/master/README.md
- https://huggingface.co/blog/transformersjs-v4
- https://huggingface.co/docs/transformers.js/main/api/env
- https://huggingface.co/docs/transformers.js/guides/webgpu
- https://web.dev/articles/client-side-ai-performance
- https://arxiv.org/abs/2402.05981
- https://arxiv.org/abs/2412.15803

## Open Questions

- May the hosted GitHub Pages build ship a same-origin `sw.js` and static manifest while the downloadable artifact remains one HTML file? This determines whether PWA/offline/file handling is implemented or the claims are removed.
- Must the new project schema open every historical JSON emitted by OpenShop, or is 0.20.0 the compatibility floor? This determines migration-fixture scope.
