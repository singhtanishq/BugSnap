# Browser compatibility

Recorded honestly: only environments actually exercised are listed.

## Test matrix (this machine)

| Environment | Version | Result |
| --- | --- | --- |
| Chromium (Playwright, darwin/arm64) | bundled with Playwright 1.65 | Full suite passes: unit-adjacent E2E, downloads, IndexedDB drafts, axe audits, network audit |
| Chrome (desktop, darwin/arm64) | current stable | Manual smoke: app loads, sample renders, annotation drawing works |
| jsdom (Vitest) | jsdom 26 | Unit/integration suites (browser APIs polyfilled: object URLs, matchMedia, ResizeObserver, fake-indexeddb) |

Playwright's Firefox and WebKit builds were **not** installed or run for this release, so no Firefox/Safari compatibility claims are made. The code paths most likely to differ:

- `getDisplayMedia` — Safari historically lacked/gated this; BugSnap degrades to an explicit "unsupported" message with upload/paste alternatives.
- `navigator.storage.estimate()` — hidden where unsupported; the UI shows a neutral notice instead of numbers.
- Web Workers (module type) — modern browsers only; synchronous fallbacks exist for every worker call.

## Feature support expectations

| Feature | Chromium | Firefox | WebKit/Safari |
| --- | --- | --- | --- |
| Core report flow, exports, drafts | expected ✅ (tested) | expected ✅ (untested) | expected ✅ (untested) |
| Screen capture still-frame | ✅ (tested to chooser; approval is manual) | ✅ (untested) | ⚠️ support varies |
| Clipboard write | ✅ with permission | ✅ | ✅ (untested) |
| File System access | not used | — | — |

## Graceful degradation guarantees

Regardless of browser, these paths are handled with actionable messages rather than crashes:

1. Screen capture unsupported / insecure context / denied / no frame → explicit message + alternatives.
2. Clipboard denied → suggestion to download the file instead.
3. Corrupt or oversized images → rejection with reason.
4. IndexedDB unavailable → drafts simply cannot be enabled; the app stays memory-only.
5. Worker construction failure → synchronous fallback for scanning/parsing.
