# BugSnap test plan

Testing is a core deliverable. The suites below run in CI on every push; each layer verifies genuinely observable behaviour, not callback invocations.

## Layers

### 1. Unit tests (Vitest, `tests/unit/`)

| Area | File | Covers |
| --- | --- | --- |
| Report readiness | `completeness.test.ts` | Real completion state, required-field gating |
| Export readiness | `reportValidation.test.ts` | Required fields, step actions, URL opt-in consistency |
| URL sanitization | `sanitizeUrl.test.ts` | Credentials, fragments, sensitive query values, benign params |
| Image/text validation | `fileValidation.test.ts` | MIME+extension agreement, size caps, truncation honesty |
| Redaction patterns | `redactionPatterns.test.ts` | 14 categories, Luhn, false positives, masking, custom rules |
| Redaction application | `applyFindings.test.ts` | Replacements in export text, ignored findings untouched |
| HAR parse | `har.test.ts` | Summary correctness, malformed input, entry caps, no raw leakage |
| HAR sanitize | `har.test.ts` | Header/cookie/query/body replacement, structure preservation |
| Annotation geometry | `annotationGeometry.test.ts` | Transforms, hit-testing, move/resize, fit scale, zoom anchoring |
| Annotation history | `annotationHistory.test.ts` | Undo/redo, redo collapse |
| Environment detection | `environment.test.ts` | UA parsing, honest labels, forbidden-field absence |
| Markdown export | `export.test.ts` | Stable section order, escaping, opt-in fields |
| JSON export | `export.test.ts` | schemaVersion, no secrets, environment selection |
| Templates | `export.test.ts` | GitHub/Jira/Linear formatting, no-integration disclaimers |
| ZIP export | `exportZip.test.ts` | Filename sanitization, inclusion rules, real ZIP entries |

### 2. Integration tests (Vitest + Testing Library, `tests/integration/`)

- **Report builder**: state survives navigation; template insertion; step duplication/deletion with renumbering; destructive-action confirmation.
- **Evidence**: upload/paste flows, validation errors, reorder/remove, screen-capture fallback messaging.
- **Diagnostics**: paste → scan → findings table → per-finding redaction → sanitized preview excludes the raw token; manual selection redaction; HAR import → summary → sanitized copy requires confirmation → include toggle unlocks.
- **Drafts**: nothing persists before opt-in; save → list → restore (with blobs) → delete-all clears IndexedDB; disable deletes stored drafts. (`fake-indexeddb` supplies the IDB implementation in jsdom.)

### 3. Browser E2E (Playwright, `tests/e2e/`, real Chromium)

| Spec | Verifies |
| --- | --- |
| `annotation.spec.ts` | Tool drawing, undo/redo, and **pixel-level proof**: exported PNG is 1280×800 with every sampled redaction pixel uniform and opaque |
| `export.spec.ts` | Real downloads: Markdown/JSON/ZIP opened and byte-inspected; sanitized content present, raw secrets absent; raw source image excluded |
| `drafts.spec.ts` | Draft lifecycle in real IndexedDB incl. reload + restore |
| `network.spec.ts` | Zero requests outside the app origin during the full workflow |
| `accessibility.spec.ts` | axe WCAG 2.0/2.1 AA on all nine pages at desktop + mobile, studio, keyboard navigation |
| `export.spec.ts` refresh case | Nested hash route reloads cleanly |

### 4. Production audit

`scripts/audit-runtime-network.mjs` serves the production build (`vite preview`), walks the workflow, and fails if any request leaves the app origin.

## Running locally

```bash
pnpm install
pnpm test            # unit + integration
pnpm test:e2e        # Playwright (starts/reuses dev server on :5199)
pnpm build && node scripts/audit-runtime-network.mjs
```

## Manual-only checks

Real OS-level screen capture (browser permission dialogs, actual window/tab contents) cannot be automated here: the flow is mocked at the browser-API boundary in integration tests and exercised up to the chooser in real browsers, but the final "approve the chooser → still frame appears" step requires human approval on each OS/browser. Documented in `browser-compatibility.md`.
