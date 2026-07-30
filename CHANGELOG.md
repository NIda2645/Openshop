# Changelog

All notable changes to Openshop will be documented in this file.

## [v0.24.0] - 2026-07-30

### Performance
- Move the highlight during animation playback instead of rebuilding the whole thumbnail strip on every tick. A 20-frame timeline at 12 fps was creating a div, an 80px canvas, an image decode and two listeners per frame, 12 times a second — roughly 240 decodes a second purely to move a border

### Security
- Drop `https://cdn.jsdelivr.net` from `script-src`. Fabric, ag-psd and jsPDF were `<script src>` tags on that host, and CSP does not require SRI on scripts it permits by host — so an allowance covering three pinned tags also let any HTML-injection sink load an arbitrary npm package. All three are now fetched, SHA-384 verified in page, and executed from `blob:` URLs, the same path the eight lazy assets already took, leaving `script-src 'self' <hashes> 'wasm-unsafe-eval' blob:`. Substituted bytes stop the editor with a visible message instead of quietly becoming the engine
- Judge every `href` in an exported SVG regardless of namespace, against an allowlist. The old `[xlink\:href]` selector matched nothing — attribute selectors match the local name in the null namespace, and `xlink:href` is exactly what fabric emits for images — so that branch was dead, and the plain-`href` checks were case-sensitive, letting `JAVASCRIPT:` and `Data:text/html` through a file handed to the user as sanitized

### Changed
- Measure what each engine actually provides instead of assuming Chromium. A capability probe now runs on all three engines and asserts the fallback for each optional platform feature: the file picker when there is no File System Access API, static GIF import without `ImageDecoder`, the recovery critical section without Web Locks, coordination without `BroadcastChannel`, and autosave without an origin-private file system. That last one is real: WebKit gives a `file://` origin no OPFS at all, so opening the single HTML file directly in Safari has no auto-save or crash recovery. The browser-support table says so now
- Collapse the duplicated model-load path. `_loadPipeline` and `_loadRmbgModel` each carried their own busy guard, job ownership, transformers load, device probe, progress plumbing, dispose-on-cancel and failure toast, so every change to the download experience had to be made twice; both now call one helper. The PSD import also stops keeping a second registry of a job `_computeJobs` already tracks
- One treatment per component instead of several. Sliders had three thumb designs and Firefox showed the pre-redesign thumb everywhere, because only `::-webkit-slider-thumb` had been restyled; there is now a single design on both vendor pseudo-elements, verified in Chromium and Firefox. Radii collapse to a 6/8/12 scale, menu bars, dropdown rows and the context menu share one hover treatment, and `transition:all` — which also animates layout-affecting properties — is replaced by named properties on three duration tokens. Hovering a colour swatch no longer tucks it under the swatch beside it, and the active animation frame is marked with a ring instead of a scale that overlapped its neighbours

### Fixed
- Export PDF pages at the document's real size. jsPDF's `px` unit produced an 800x533pt page for a 600x400 document — an 11.1 inch wide page at roughly 54 DPI — so printing or placing the file gave something a third larger than intended. Pages are now sized in points from CSS pixels (450x300pt, 6.25x4.17in at 96 DPI) with the raster still at full resolution, and the file carries a title, creator and language
- Write a resolution resource into exported PSDs. Without one the file declared no DPI at all and its physical size was whatever the reader defaulted to; it now declares 96 PPI, matching the PDF export
- Every AI feature was broken. Background removal, Segment Select, Depth Map and Object Detection each handed the model a `data:` URL, which Transformers.js reads with `fetch()` — and `connect-src` does not list `data:`, so the request was blocked the moment the model finished downloading. They now receive canvas pixels directly, which also skips a full-image PNG encode and decode. Verified by running background removal end to end against the pinned MODNet weights: 3.3 s cold including the 25.9 MB download, 0.8 s warm
- Report a model as loaded when background removal is holding it. Its handles live outside `_aiPipelines`, so the Offline & Install dialog and the backend report both claimed nothing was loaded while a model was resident
- Stop routing pixel filters to Photon unless its result matches the JavaScript worker byte for byte. Measured on a 16x16 fixture, Photon's grayscale differs by up to 58 levels (it does not use the Rec.601 weights the rest of the app and the histogram use), sepia by 192, threshold flips pixels outright, and the sharpen and emboss convolutions zero the alpha of the outermost pixel ring — a transparent one-pixel frame. Which result you got depended on whether an optional WASM download succeeded; only `invert` agrees, so only `invert` is accelerated
- Break cyclic PSD group parents when a project is opened rather than letting them silently drop layers from a PSD export. Validation checked only that a parent existed, which `parentId === id` and longer loops satisfy, and the writer emits only what the walk from the document root reaches — so a looped group and every layer parented into it vanished without a word. Cycles now flatten to the root with a warning, and the export report names anything the root walk still could not place
- Version the service worker's runtime cache with the shell and prune it alongside. It was unversioned, unbounded and cache-first, so a fix to any asset outside the enumerated shell never reached a client that had already cached it. Opaque responses are no longer stored at all — an opaque response hides its status, so a captive-portal or CDN error page was kept and served forever; cross-origin runtime requests are re-asked with CORS so the status is visible, and the cache is capped at 60 entries
- Stop recovery ownership from flapping when another tab owns the stream. Autosave switches this tab to a fresh document id, but every history snapshot embeds the old one, so each undo re-installed the contested id and the next autosave renamed again — orphaning a set of generations every time, which were then offered as unsaved work on a later launch. The surrendered ids are now tracked as a session lineage: snapshots no longer re-claim them, and Save Project clears the generations written under all of them
- Refuse to autosave while a document load is in flight. `canvasW/H` are assigned before `loadFromJSON` resolves, so a capture landing in that window persisted the outgoing document's content under the incoming document's dimensions, stored against the outgoing id — a generation that restored at the wrong size and could evict a good one under the five-per-document retention cap. The work now stays queued and flushes once the load settles

## [v0.23.0] - 2026-07-30

### Performance
- Bound undo history by retained memory as well as entry count. Each entry embeds full base64 image sources, so 60 steps on a 12 MP photo could retain gigabytes; history now evicts against a 192 MB budget, always keeping at least one entry, and Image Information reports the retained size
- Keep the Levels and Color Balance sliders interactive on large photos: each tick used to run a full-resolution pixel pass, encode the result to a PNG data URL, and decode it again. Previews now run on a downscaled proxy, swap the working canvas straight into the layer, and use a 256-entry lookup table instead of three `Math.pow` calls per pixel; Apply still commits at full resolution

### Added
- A pseudo-locale that accents and brackets every translated string, so any interface text that never went through the localisation machinery is obvious at a glance; the Chinese map is now gated at parity with English apart from format names and single-letter typographic controls

### Fixed
- Report each cached model's size and whether it is loaded, and let a model's cached files be cleared individually rather than only by wiping all site data
- Probe for a usable WebGPU adapter and fall back to WASM, instead of pinning both model pipelines to WASM while the README promised WebGPU; the chosen backend is shown with the download progress
- Rename Smart Upscale to Enlarge (resample) and move it out of the AI menu into Image, because it is stepped canvas resampling with a sharpening pass and no model is involved
- Set the document's language and direction when the locale changes, which assistive technology, hyphenation, and bidirectional text all depend on and which the locale switch never touched
- Give canvas text an explicit direction and mirror the menu chrome with logical properties, so a right-to-left locale no longer strands shortcuts and submenu arrows on the wrong edge or reorders Arabic mixed with Latin and numerals
- Collapse the two competing mobile stylesheets into one. The first block was almost entirely overridden — it set a 36px topbar against 44px, a flush-bottom toolbar against the floating one, and a 200px tablet panel against 248px — so edits to it did nothing and any reordering would have flipped the mobile layout wholesale. The animation timeline also now clears the floating toolbar instead of sitting under it
- Honour the New Image background choice: the colour picker was read by nothing, so every new document came out transparent whatever was selected. The dialog now offers Transparent, White, or a custom colour, and the swatch is enabled only when it applies
- Save every preference, not just the language: default canvas size, grid size, snap tolerance, history cap, and accent colour now survive a reload, and a corrupted store is clamped on the way in rather than being able to disable undo
- Read GIMP `.gpl` and Adobe `.ase` palettes, both of which the file picker already advertised while the reader only ever parsed JSON, and report why a palette was rejected instead of a bare "Invalid palette file"
- Populate the welcome screen's Recent list, which was permanently empty because nothing ever recorded an opened document, and present the rows as the history record they are rather than as clickable shortcuts that did nothing

## [v0.22.0] - 2026-07-30

### Performance
- Run Solarize, Vibrance, Exposure, Shadows/Highlights, Photo Filter, Curves, Channel Mixer, Auto Levels, Auto Contrast, and Auto Enhance in the filter worker instead of blocking the main thread, so they can be cancelled mid-run and the interface stays responsive on large images
- Coalesce the Color Range preview instead of recomputing the whole mask on every fuzziness slider tick

### Added
- Keyboard alternatives to every drag: arrow keys move the selected object, Shift makes the step 10px, Alt resizes it, and Ctrl+Alt+Up/Down reorders the active layer
- Automated WCAG 2.2 gates for text contrast in all three themes, 24x24 minimum pointer targets, and the non-drag paths above
- Cross-engine test gate: the core open, edit, filter, save, recover, export, keyboard, and dialog flows now run automatically on Firefox and WebKit as well as Chromium (`npm run test:cross-browser`)
- A single assertion that keeps the version in `package.json`, `package-lock.json`, the README badge, the changelog, the page title, the in-app labels, and the offline shell revision aligned

### Security
- Add `base-uri 'none'` and `form-action 'none'` to the content security policy, neither of which falls back to `default-src`, closing a `<base href>` injection that could have redirected every relative URL including the service worker
- Widen the inline-handler check in the security gate from four specific attributes to any `on*=` handler, so an `onerror=` or `onload=` can no longer pass a gate that claims to cover them

### Fixed
- Store pixel selections in document space instead of screen space: zooming or panning between selecting and deleting no longer erases a different part of the image, and deleting below 100% zoom no longer leaves a sparse grid of surviving pixels
- Make the Lasso select the shape it encloses instead of its bounding box, mapped through the current zoom and pan, with a soft antialiased edge
- Give selections real partial coverage: Feather now keeps the gradient it computes instead of throwing it away and widening the hard edge by a pixel, deleting fades pixels by how selected they are, and the selection tint shows the falloff
- Delete every pixel under the selection on a layer scaled below 100%, which previously kept two out of three because the mask was stamped onto the image rather than sampled by it
- Preserve partial selection coverage in saved projects; projects written with the older one-bit format still open
- Keep the marching-ants box over the selection when the viewport moves
- Rescale selection masks saved by earlier versions into the document when a project is opened, rather than leaving them addressing pixels the document does not have
- Stop filters reporting success before the edit is actually committed: the "applied" toast, the panel close, and Reapply Last Filter now wait for the commit, so a result rejected because the document changed no longer produces two contradictory messages
- Apply one consistent rule for whether an edit is still valid, so a target removed from the canvas or on a locked layer is rejected the same way by every path instead of three different ways
- Stop the full-screen progress dialog flashing for filters that finish in a few milliseconds
- Raise the contrast of the welcome card's helper text, the active export-format and curves-channel pills, and the export preview placeholder, all of which fell below 4.5:1
- Enlarge the zoom readout, the offline status chip, the palette buttons, and the preference fields to the 24x24 minimum
- Correct the browser-support table to say what is actually verified on each engine rather than claiming blanket full support
- Sync `package-lock.json`, which still declared 0.20.0 after the 0.21.0 release
- Guard the last ten pixel adjustments against a document that changed while they ran: a result that arrives after the layer was replaced, deleted, or edited is now discarded rather than written over the new pixels
- Let a second AI request take over from the model download it cancels — starting one while another was loading used to kill both and require a third click
- Operate the whole menubar from the keyboard: arrow keys move between menus and rows, Enter or Space opens and activates, Home and End jump to the ends, typing a letter jumps to the next matching row, Escape closes one level at a time, and clicking a menu title now keeps it open instead of requiring the pointer to stay put
- Announce menus correctly to screen readers: menus, rows, separators, and submenu state carry real roles, submenu arrows and nested rows no longer leak into a menu's own name (Filter announced as "Filter ▸ ▸ ▸ ▸ ▸ ▸ ▸ ▸"), shortcuts are exposed as key shortcuts rather than name text, and the "Models download on first use" note in the AI menu is no longer hidden from assistive technology
- Keep Tab inside the open dialog instead of letting it walk into the editor behind, move focus into a dialog when it opens, and hand focus back to the control that opened it when it closes — applied to every dialog, the welcome launcher, and the command palette
- Name every dialog to assistive technology from its own heading and mark it modal, without publishing the same dialog twice for panels that already declared themselves
- Follow the selected theme in the last chrome that ignored it: lasso fill, welcome glow and primary-button glow, template-card hover, layer-thumbnail transparency checkerboards, ruler guides, and smart guides now come from the token scale
- Paint Free Transform handles in the accent colour — the handle colour was a CSS variable string handed to the canvas, which is not a valid fill and was silently discarded
- Stop Escape from falling through a dialog that has no cancel button: pressing it during the crash-recovery prompt no longer dismisses the welcome screen underneath and reaches the canvas shortcut handler

## [v0.21.0] - 2026-07-30

### Fixed
- Stop the import sanitizer from rewriting the editor's own snapshots: undo, redo, transaction rollback, project open, and recovery restore now preserve multi-line text, text longer than 500 characters, and base64 image sources exactly
- Keep selection overlays out of PNG, JPEG, WebP, PDF, PSD, flatten, crop, and before/after captures; the tint no longer bakes into exported or flattened pixels at any zoom level
- Stop a second command started during an in-flight asynchronous command from rolling back the first command's work
- Keep the document marked unsaved when an edit lands while a project save is clearing recovery generations
- Confirm before replacing a document that has unsaved changes, from New Image, templates, Open Image, Open Project, Open PSD, drag and drop, and installed-app launches, with a Save first option
- Show the crash-recovery offer above the welcome launcher instead of behind it, so it is visible on the first run after a crash

- Stop the hosted offline shell from rolling back an update after a single unconfirmed navigation; opening a second tab, refreshing during load, or closing the tab early no longer discards a healthy update, the rolled-back shell cache is retained, and a Rebuild Offline Shell action can re-stage without waiting for a new revision
- Report a cached shell against the asset manifest that populated it, so changing the pinned asset list no longer reports a complete shell as incomplete forever

- Make the Midnight and OLED themes apply to the whole studio: the precision-studio chrome now draws from the design tokens instead of ~170 hardcoded literals, so the topbar, toolbar, panels, dialogs, status bar, and canvas well all follow the selected theme, and the canvas-drawn rulers, curves grid, histogram, navigator, and before/after chrome repaint on a theme change
- Persist the selected theme across reloads and apply it during startup rather than after the welcome screen is dismissed
- Validate numeric dialog input instead of silently substituting defaults: New Image, Resize Canvas, and Preferences now clamp to their declared ranges, so a negative or empty value can no longer create an invalid canvas or disable undo by setting a non-positive history limit
- Reject invalid amounts in Expand, Contract, and Border Selection, and keep the existing selection when the operation would clear it, instead of wiping it and reporting "expanded by NaNpx"
- Show the accent colour currently in effect when Preferences opens, so applying an unrelated preference no longer resets a customised accent
- Keep toasts readable: errors stay on screen long enough to read, long messages wrap instead of overflowing, hovering pauses dismissal, clicking dismisses, and toasts are no longer hidden behind the timeline, macro, Liquify, or before/after surfaces
- Close filter panels, Liquify, and before/after with Escape instead of falling through to the canvas and clearing the selection while the panel stays open
- Keep modeless workspace panels below modal dialogs so a dialog is never overlapped by an un-dimmed panel
- Stop the status bar from re-announcing on every pointer move, and announce each toast once instead of twice
- Replace version-control jargon in the save-state and offline chips with plain language
- Report images that fail to decode instead of doing nothing at all, and stop renaming the open document when an open fails
- Bound animated GIF import by frame count and decoded size, close the decoder on every path, and discard a slow import if the document changed meanwhile
- Accept PSD and `.openshop` files dropped anywhere in the window, not only over the canvas, and say when extra dropped files are ignored
- Allow SVG in the Open Image picker, which previously advertised SVG but greyed it out
- Walk one step per undo when undo or redo is triggered faster than a restore completes; overlapping restores no longer interleave or mis-map layer membership
- Preserve layer masks, per-object opacity, blend mode, skew, shadow, and the object's own name when a filter or AI operation commits pixels
- Report filter failures instead of leaving the dialog open with no feedback when a worker errors
- Make Ctrl+K work on the welcome screen where it is advertised, and stop advertising Ctrl+Shift+P and Ctrl+N, which the browser reserves; the fullscreen shortcut is now listed consistently as F
- Confirm dialogs with Enter, matching the existing Escape-to-cancel behaviour
- Explain when the command palette has no matches and when its list is truncated
- Report the real outcome of Batch Export instead of always claiming success, and say when no format is selected
- Offer an inline undo when clearing the palette or recorded actions, which canvas history cannot recover
- Warn once that animation frames are flattened snapshots before the timeline replaces a multi-layer stack
- Translate the renamed Save Project menu item in Simplified Chinese
- Restore the previous document when opening a project or recovery generation fails partway through, instead of leaving a half-replaced canvas whose layers panel, history, and save state disagree
- Enforce the PSD decode budget before any pixels are allocated by reading the layer structure first; the previous `totalMemoryLimit` option does not exist in ag-psd and was silently ignored, so a small crafted file could exhaust memory during decode
- Export eraser strokes as erased pixels rather than solid black in PSD layers
- Release sticky-note drag listeners when a note is deleted instead of leaving document-level handlers behind for the session
- Retry a lazily loaded runtime library once bypassing the HTTP cache when its integrity check fails, so a poisoned cache entry no longer disables that feature until the cache expires
- Make template cards, New Image size presets, and the zoom indicator real buttons so they can be reached and activated from the keyboard, and give the layer visibility and lock controls accessible names
- Keep the export dialog's alpha preference when the JPEG format button is clicked more than once
- Report GIF export failures, clamp the frame rate to a usable range, and release the exported blob
- Explain why recovery actions are unavailable for a corrupt generation instead of showing an unexplained disabled button

### Performance
- Stop encoding a full-resolution PNG of the whole document on every edit and every zoom step: the navigator now renders at thumbnail scale, zoom and pan update only the viewport rectangle, and minimap and histogram refreshes coalesce into one frame and skip entirely while their panels are hidden

### Removed
- Delete unreachable code: the unused layer-rebuild, legacy recovery-restore, duplicate new-document and background-removal wrappers, and a PSD branch that could never run

### Changed
- Reimagine the editor as a high-contrast precision studio with a floating tool dock, structured inspector cards, technical canvas workspace, local-only trust indicator, and compact ready state
- Replace the welcome screen with a responsive local-first workspace launcher whose templates and primary actions remain reachable from phone through desktop widths
- Make mobile inspector groups independently usable through a bounded, scrollable drawer with no horizontal page overflow
- Unify project save/open, recovery, and history on document schema v1 with stable layer/object identity, masks, guides, selections, animation, active-state preservation, and legacy OpenShop/Fabric migration
- Make project and recovery writes transactional with visible clean/dirty/saving/saved/error states, acknowledged worker autosaves, revision-safe concurrent edits, and stale file-handle resets on new/open/recovery flows
- Move the complete PSD decode into a cancellable worker and atomically prepare every decoded layer before replacing the open document
- Keep all onboarding actions and dialog footers reachable at supported phone, tablet, portrait, and landscape sizes with safe-area spacing, touch-sized controls, and keyboard dismissal
- Keep layer ownership, panel order, Fabric stacking, export order, and edit eligibility synchronized; lock, visibility, opacity, blend, rename, and reorder changes now round-trip through history and project files
- Replace label-based macros with validated schema-v1 commands and atomic action replay; initialize history without a fake edit, coalesce live previews, and make crop, flatten, canvas rotation/flip, and frame changes fail-safe and exactly undoable
- Make raster export alpha/matte behavior explicit with real previews and format-loss guidance; keep checker pixels out of PNG, WebP, JPEG, SVG, and PDF output, restore temporary canvas state on failure, and leave project dirty state untouched
- Preserve nested PSD groups, supported blends, 0–1 opacity, visibility, locks, and basic editable text across import/export/reimport; avoid composite-layer duplication and report precise whole-document or per-layer raster fallbacks for unsupported semantics
- Replace the singleton autosave with checksum-verified immutable OPFS generations, staged promotion, bounded retention, corrupt-newest fallback, legacy migration, quota/durability UI, per-generation recovery actions, and cross-tab ownership forks
- Split distribution into a truthful network-first standalone file and a hosted PWA with a verified offline shell, health-confirmed updates, automatic rollback, install/cache diagnostics, and installed-app image/PSD/`.openshop` launch handling; project saves now use the dedicated extension while legacy `.json` remains readable
- Route PSD import, worker filters, AI inference, and chunked pixel post-processing through cancellable document jobs that reject pending work, terminate disposable workers, discard stale replies, and commit pixels/history only while the original document revision and target remain current

### Security
- Upgrade Fabric.js from 5.3.1 to 7.4.0 with legacy project adapters and browser regressions for stored-SVG injection through object IDs and gradient colors
- Refresh the contributor lock to PostCSS 8.5.25 and Nano ID 3.3.16, synchronize its root version, and add a release test command that fails on high or critical npm advisories
- Enforce a 256 MB aggregate PSD decoded-pixel budget in addition to existing file, canvas, layer-count, nesting, and per-layer bounds
- Replace 380 executable HTML event attributes with opaque actions backed by a frozen 288-entry listener registry
- Remove `unsafe-inline` and unrestricted `unsafe-eval` from script policy, hash both reviewed inline scripts, and add a release check that rejects stale hashes or handler regressions
- SHA-384 verify every lazy PSD, Photon, GIF, Transformers.js, and ONNX runtime payload before executing it; poisoned responses fail closed and are not retained

## [v0.19.1] - 2026-07-01

### Fixed
- Fix _sanitizeProjectValue truncating base64 data URLs to 500 chars, destroying saved projects on load (P0)
- Fix deselectSelection undefined method in context menu (should be deselectAll)
- Fix deleteLayer crash when all layers removed (auto-create empty layer)
- Fix _applyPreferences overwriting current document dimensions with default preferences
- Fix _selectionPath undefined reference in context menu (use _selectionBounds)
- Fix duplicateLayer async clone race: defer saveHistory until all clones complete
- Fix selectFrame destroying canvas state: rebuild boundary and layers after clear
- Fix filter worker race condition on concurrent operations via job ID message routing
- Fix blob URL memory leaks across all export/download paths (revoke after 60s)
- Fix draggable filter panel document listener leak via AbortController cleanup
- Fix guide listener leak on clearGuides (store and call cleanup functions)
- Fix _hexToRgba and _hexToOklch failing on 3-digit hex shorthand (NaN propagation)
- Fix previewLayerStyle drop shadow silently overwritten by outer glow (prioritize drop shadow)

### Security
- Fix SVG sanitizer only stripping 4 of 70+ event handler attributes (now strips all on* attributes)
- Fix macro replay allowing execution of private/internal methods via crafted JSON
- Fix macro load accepting arbitrary unvalidated JSON arrays

### Changed
- Timeline and macro panel positions now use CSS variables instead of hardcoded pixel offsets
- Recording indicator, macro button, AI progress bar, and grid colors now use theme CSS variables
- Active tool button box-shadow uses glass-border variable instead of hardcoded accent rgba
- Mobile panels accessible via slide-over drawer with toggle button instead of permanently hidden
- Color Range dialog wraps to fit mobile viewport
- Meta charset moved to first child of head per HTML spec
- Command palette input has aria-label for screen readers

## [v0.19.0] - 2026-07-01

### Security
- Remove all inline event handlers from dynamically generated HTML (modals, layer list, color range, export settings)
- Convert modal buttons from onclick attributes to addEventListener with data-attribute delegation
- Convert layer panel visibility/lock/rename handlers from innerHTML onclick to DOM event listeners
- Convert New Image presets, Color Range controls, and Curved Text sliders to delegated event wiring
- Add global data-modal-close and data-suffix delegation handlers for modal buttons and range labels

### Added
- Unit tests for project save round-trip, recovery offer/restore/discard, SVG sanitization, and PSD export structure
- Playwright mobile viewport smoke test verifying toolbar and canvas render on 375x667
- Test harness modal delegation support via installModalDelegation helper
- Responsive mobile layout: toolbar moves to bottom, right panels collapse, modals fit viewport at <768px
- Tablet breakpoint: right panels narrow to 200px at 768-1023px
- Two-finger pinch-to-zoom and pan gestures on canvas for touch devices
- Animated GIF export via on-demand gif.js with spritesheet fallback for unsupported browsers
- GIF import via WebCodecs ImageDecoder: multi-frame GIFs load into timeline with per-frame editing
- Static image fallback for single-frame GIFs and browsers without ImageDecoder support
- OKLCh color value display in the foreground color panel alongside hex values
- sRGB to OKLab/OKLCh conversion computed inline using the Oklab specification matrix transforms
- i18n infrastructure: automatic DOM text discovery via _initI18n(), locale map with _t() lookup, setLocale() for switching
- Language selector in Preferences dialog (English default, extensible for community translations)
- 28 common toast messages converted to _t() locale-aware lookup (project, undo, filters, adjustments)

## [v0.18.12] - 2026-06-28

### Added
- Add Recovery Storage UI with autosave age, size, quota, restore, export, and discard actions
- Detect corrupt autosave data and block restore while preserving export/discard options
- Add unit coverage for recovery status rendering and sanitized restore flow

## [v0.18.11] - 2026-06-28

### Security
- Add central import schema and resource-budget helpers for project JSON, palettes, presets, and images
- Clamp project dimensions/object counts, image dimensions/file sizes, palette colors, preset counts, and adjustment ranges through shared validators
- Add unit coverage for hostile project, palette, preset, and image import fixtures

## [v0.18.10] - 2026-06-28

### Security
- Add PSD header and structure preflight before bitmap decode
- Enforce PSD file size, dimension, pixel, layer count, bit-depth, and color-mode budgets
- Parse PSD structure in a worker when available, with main-thread fallback and unit coverage for oversized fixtures

## [v0.18.9] - 2026-06-28

### Security
- Render command palette, context menu, sticky notes, animation frame labels, macro steps, AI progress titles, and save-preset modals through DOM APIs
- Remove runtime inline handlers from those generated UI surfaces
- Add malicious fixture coverage for dynamic UI renderers

## [v0.18.8] - 2026-06-28

### Security
- Replace worker filter source-string execution with a named operation registry
- Remove `unsafe-eval` from the document CSP while preserving Photon fallback behavior
- Add regression coverage for op-based worker payloads and CSP string-execution guards

## [v0.18.7] - 2026-06-28

### Security
- Render recent files, templates, saved palettes, and photo presets through DOM APIs instead of persisted-data `innerHTML`
- Validate saved/imported palette colors as hex colors and normalize imported preset names/adjustment values
- Add unit and Playwright malicious fixture coverage for recent, palette, and preset rendering

## [v0.18.6] - 2026-06-28

### Added
- Hidden canvas accessibility tree mirroring current tool, active layer, object count, selection state, and layer list for screen readers
- Polite canvas live region for status/action announcements, plus `aria-roledescription` and state-rich canvas labels
- Unit and Playwright coverage for assistive-technology state mirroring

## [v0.18.5] - 2026-06-27

### Added
- AI Segment Select tool with click-to-mask pixel selections using pinned `Xenova/detr-resnet-50-panoptic`
- Unit and Playwright coverage for mocked panoptic segmentation result routing into the existing pixel-selection mask path

### Changed
- README AI docs now distinguish the supported Transformers.js panoptic segmentation workflow from unsupported SAM-style mask-generation

## [v0.18.4] - 2026-06-27

### Added
- Optional Photon WASM filter backend loaded on demand from jsDelivr for supported pixel filters
- JS worker fallback path when Photon/WASM loading fails or an operation is unsupported
- Unit coverage for Photon preference, fallback disablement, and direct filter routing

### Fixed
- Command palette direct color filters now route to `applyFilterDirect()` instead of the missing `applyFilter()` helper

## [v0.18.3] - 2026-06-27

### Added
- Vitest + Playwright testing foundation with unit coverage for tool switching, layer add/delete, undo/redo, PNG export naming, and keyboard shortcuts
- Playwright browser smoke test with editor-shell screenshot comparison

### Changed
- Document contributor-only test commands while keeping the shipped app as a single HTML file

## [v0.18.2] - 2026-06-15

### Security
- Pin AI model revisions to immutable commit SHAs instead of mutable 'main' branch refs

### Changed
- PSD export: File → Export As → PSD writes layered .psd files via ag-psd writePsd() (layers, opacity, visibility preserved)
- CDN resources pre-cached via Cache API for offline capability (Fabric.js, ag-psd, jsPDF, fonts)
- Filter Worker redesigned as generic function executor — any filter can now run off-thread
- Posterize, Threshold, Vignette, Edge Detect filters moved to Web Worker (joins Oil Paint, Tilt Shift, Unsharp Mask)
- Upgrade Transformers.js from 3.3.3 to 4.0.0 (WebGPU C++ runtime, image segmentation support, esbuild bundles)
- Minimap updates are now event-driven (on canvas change/zoom) instead of polling every 2 seconds

### Fixed
- OPFS auto-save now works on Safari via Worker + createSyncAccessHandle() fallback (createWritable() not supported in Safari)
- Auto-save dirty flag wired up — no longer serializes entire canvas every 30 seconds when nothing changed
- Manual project save now clears auto-save data to avoid stale recovery prompts
- Global error/unhandledrejection handlers surface silent failures as user-visible toasts

## [v0.18.1] - 2026-06-15

### Security
- Upgrade jsPDF from 2.5.1 to 4.2.1 to patch CVE-2026-25755 (PDF object injection)
- Mitigate Fabric.js CVE-2026-27013/CVE-2026-44311: sanitize SVG export output and strip XSS vectors from project JSON on load
- Pin Transformers.js AI model revisions via _modelRevisions map to prevent supply-chain poisoning
- Add SRI integrity hashes to all CDN-loaded scripts (fabric.js, ag-psd, jsPDF)
- Fix ag-psd CDN reference (v22.2.0 does not exist; corrected to v22.0.2)
- Sanitize PSD layer names in layer panel to prevent HTML injection via crafted PSD files
- Add HTML escape helper (`_esc()`) for all user-supplied strings in innerHTML contexts

### Added
- Auto-save project state to OPFS every 30 seconds with crash recovery prompt on reload
- One-click Auto Enhance (auto-levels + vibrance + contrast + sharpening) via Image menu and command palette
- Photo Presets system: 8 built-in presets (Warm Glow, Cool Tone, Vintage, Vivid, Dramatic, Pastel, B&W High Contrast, Golden Hour) with JSON import/export and custom preset saving
- Symmetry tool: horizontal, vertical, both-axes, and radial (6-fold) mirroring for brush strokes (View menu)
- EyeDropper API integration: system-wide color picking on Chrome/Edge, canvas fallback on other browsers
- File System Access API: native save/open dialogs on Chrome/Edge with graceful fallback to download/file-input
- Web Worker filter pipeline for Oil Paint, Tilt Shift, and Unsharp Mask — UI stays responsive during heavy filters
- Content Security Policy meta tag restricting script/style/connect sources
- ARIA accessibility: roles, labels, live regions on all major UI elements (menubar, toolbar, panels, canvas, dialogs, toasts, layers, history)
- Keyboard activation (Enter/Space) for all tool buttons; tabindex on toolbar
- .psd added to PWA file_handlers manifest

### Fixed
- Version string mismatch: saveProject() now writes v0.18.0 (was hardcoded to v0.16.0)
- Sync version references across README.md and CHANGELOG.md
- PWA service worker: removed broken blob-URL registration (browsers reject it)
- Replace all 15 empty catch blocks with appropriate console.warn/debug logging

## [v0.16.0] - %Y->- (HEAD -> main, origin/main, origin/HEAD)

- docs: add Related Tools cross-reference to PyShop
- Added: Add web link to Quick Start section
- Added: Add files via upload
- Changed: Update README.md
- Added: Add files via upload
- Changed: Update README.md
- Added: Add files via upload
- Added: Add files via upload
- Added: Add files via upload
