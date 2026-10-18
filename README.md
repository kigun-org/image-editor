# Image Editor

A browser image editor distributed as one `image-editor.js` file with embedded styles.
It uses Svelte, Fabric, Pixi, and FlyonUI styles inside an open shadow root. It does not define a
custom element. The host owns persistence.

## Development and build

Use Node 22.12 or later and pnpm 12.5.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

`pnpm dev` starts the demo. `pnpm build` builds the library into `dist/`.
These commands retain separate entry points. Build output is not committed.
The build targets Safari 16.4, Chrome 111, and Firefox 128 or later. Current
Playwright browser tests do not establish testing of every minimum version.

## Public API

Import the default constructor. No separate stylesheet is required. Remove any
old `image-editor.css` link when upgrading:

```js
import ImageEditor from '/assets/image-editor.js';

const editor = new ImageEditor({
  target: document.getElementById('editor'),
  props: {
    saveCallback: async (blob) => {
      // Persist the Blob. Reject the Promise if persistence fails.
      await saveImage(blob);
    }
  }
});

editor.$set({ imageBlob: file }); // Replace the source through public props.
editor.$destroy();              // Release resources when the host removes it.
```

| Property | Meaning |
| --- | --- |
| `theme` | `system` (default), `light`, or `dark`. System mode follows the nearest host `data-theme` or `light`/`dark` class, then the operating system preference. Update with `$set` without resetting the image. |
| `imageBlob` | Optional initial or replacement Blob or File. |
| `saveCallback` | Required callback receiving a Blob. Return a Promise that resolves after persistence or rejects on failure. Synchronous throws are also handled. |
| `galleryURL` | Optional gallery JSON URL. |
| `passthroughOriginal` | Show the gallery original-copy action. Defaults to true. |
| `validators` | Advisory entries with `test(image: HTMLImageElement)` and `message`. Return true to show a warning. Warnings apply to editing and original copying. |
| `imageLimits` | Optional overrides for `maxInputBytes`, `maxInputPixels`, and `maxEditorDimension`. |

Defaults are 50 MiB per input, 80 million source pixels, and 8192 pixels per
working edge. The editor rejects oversized inputs and resizes accepted images
when the working edge or device capabilities require it. A notice reports
resizing. These defaults are not a guarantee that every device can process the
largest image.

Signatures and supported header dimensions are checked before decoding. Some
browser-supported formats still require decoding before their dimensions can
be checked. Those formats retain a predecode allocation risk. The host must
validate uploads on the server and apply its authentication and CSRF rules.

Edited output is JPEG at quality 1.0. Verified raster originals retain their
exact bytes, MIME, and supported animation. SVG and decoded unknown formats
are normalized to PNG and labeled accordingly. The host must use the Blob's
actual format when it chooses a filename. Save errors preserve edits and
provide retry. Destroying the component releases its owned resources.

Gallery response shape:

```json
{"visits":[{"title":"Examples","images":[{"id":"one","url":"/images/one.png","thumbnail":"/images/one-thumb.png"}]}]}
```

Gallery and image requests must pass browser same-origin or CORS checks.

## Library-only tests

```sh
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm check:tests
pnpm test
pnpm check:size
pnpm check:deps
```

| Command | Purpose |
| --- | --- |
| `test:unit` | Pure parsing, limits, geometry, CSS isolation, and command contracts. |
| `test:browser` | Direct component harness in Chromium, Firefox, and WebKit, plus touch smoke tests. |
| `test:dist` | Fresh library build, then a separate static host using the default constructor below a non-root URL. |
| `test` | Run unit, browser, and distribution suites in sequence. |
| `check:tests` | Type-check tests and configurations. |
| `check:size` | Require the two named assets. Enforce gzip level 9 budgets of 303,581 JavaScript bytes and 8,192 CSS bytes. |
| `check:deps` | Save full and production audit reports in `.reports/audit`. Fail on high or critical findings or an inconclusive audit. |
| `test:perf` | Dedicated built-library performance tests. Build first. |

Tests do not import `App.svelte` or the demo entry point. The direct component
harness disables HMR because Svelte's HMR wrapper does not preserve the legacy
constructor prototype methods. Normal demo HMR is unchanged. The static host
serves the built assets without a development-source fallback.

Browser tests use local fixtures and controlled callbacks. One worker limits
concurrent canvas allocations. CI permits one diagnostic retry but fails flaky
tests. Traces and screenshots remain under `test-results/`. Lifecycle tests
repeat mounting, editing, saving, and destruction 20 times with a surviving
second editor.

## Performance and manual validation

Run baseline and candidate on the same idle GPU-enabled machine, OS, browser,
and device settings. The runner records this environment, the Git revision,
built-asset hashes, and generated fixture hashes. It takes 20 samples after three warmups for small
and 12 MP images. It reports median and p95 for loading, preview, adjustment
scheduling, and export. Regressions above 10% fail comparison. Adjustment timing
includes two animation frames; it does not measure GPU execution time directly.

```sh
EDITOR_DIST_DIR=/absolute/path/to/baseline-assets EDITOR_PERF_REPORT=.reports/performance/baseline.json pnpm test:perf
EDITOR_PERF_BASELINE=.reports/performance/baseline.json pnpm test:perf
EDITOR_PERF_LARGE=1 pnpm test:perf
```

The large-input case uses real 80 MP, 8192-edge, and 50 MiB inputs. Run it on a
machine with sufficient memory, outside shared PR runners.

The accessibility target is WCAG 2.2 AA. Native controls support keyboard editing of adjustments and annotations.
Crop position and size use the canvas handles. The toolbar keeps the aspect-ratio
checkbox and omits numeric crop fields and nudge buttons. Toolbar actions use Lucide icons with
accessible names and 44-pixel minimum targets. Tooltips appear on hover and
keyboard focus, remain open while hovered, and close with Escape. Touch devices
also show text labels. Only the required Lucide icons are imported.
Before release, manually test the
library host with VoiceOver and Safari, NVDA and Firefox, real mobile Safari,
200% text enlargement, and 400% browser zoom. Automated scans do not establish
complete conformance.

## Dependency maintenance

This editor uses Vite 8.3.4 as a patch update from the shared 8.3.0 contract.
Other widgets are unchanged. pnpm recorded the exact `vite@8.3.4` release-age
exception in `pnpm-workspace.yaml` during the requested upgrade. There is no
general release-age exemption.

The compatible `source-map-js: 1.2.2` override fixes GHSA-68fv-2mgg-jv7q in
Tailwind's dependency tree. Remove it when normal resolution no longer selects
the affected version. TypeScript stays at 6.0.3 because the current Svelte
checker does not declare TypeScript 7 support.

The image renderer requires WebGL. Initialization or context failure shows a
retry action. Canvas2D is not an accepted fallback because it omits the color
filter used for brightness and contrast.

The annotation color picker shares the annotation tool row. It updates the
selected annotation and sets the color for new annotations. Select existing
annotations directly on the image. Selection actions retain their space when
no annotation is selected. Stopping freehand mode selects the latest
stroke. Advisory and crop warnings float over the preview and can be dismissed.
Crop warnings return after the crop moves inside the image and then outside again.
Warning text is vertically centered. A warning triangle remains beside Crop
while its area extends outside the image. The preview uses a checkerboard for
transparent pixels and areas without an image. Warnings and the checkerboard
are not included in the saved image.

Sliders use the FlyonUI range component. Warning alerts use the standard solid
FlyonUI style with a triangle exclamation icon. Dark warning text and icons
maintain contrast against the default amber background.

FlyonUI is CSS-only. Tailwind 4.3.3 runs through PostCSS with full Preflight.
Framework styles and Svelte styles load inside each editor's shadow root.
Host selectors cannot style editor contents. Editor styles do not affect the
host page. The internal root resets inherited styles and defines its own theme.
Editor rem lengths use a 16px baseline, independent of host root font rules.
Browser zoom, reduced motion, and forced colors remain supported.
Host layout still controls the outer container's size, position, and visibility.
DOM integrations must query the open shadow root to reach editor contents.
There is no FlyonUI JavaScript initializer. Buttons use solid backgrounds,
and selects use native arrows so contrast checks can inspect the text background.
The old canvas-size package
was removed because its probe retained an object URL. The editor now owns and
releases its bounded canvas probe.

## License

Licensed under AGPL-3.0-only. See [LICENSE](LICENSE). For alternative licensing,
contact [Kigun](https://www.kigun.org/).
