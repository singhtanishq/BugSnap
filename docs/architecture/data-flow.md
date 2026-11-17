# Data flow

Everything below happens inside the browser tab. No step sends report content over the network.

## 1. Intake

```text
File / paste / drag-drop / getDisplayMedia
  → validate (MIME + extension + size caps)
  → decode (createImageBitmap with <img> fallback, pixel-area guard)
  → blob → evidenceStore (memory, keyed by id)
  → metadata → ReportProvider state
```

Screen capture: user clicks a labelled control → browser's chooser → `getDisplayMedia` → one still frame drawn to an offscreen canvas → **every track stopped** on success, failure and cancellation.

## 2. Annotation

```text
pointer events → view transform (scale/offset) → image-space coordinates
  → draft annotation → committed via history (undo/redo)
  → report.evidence[id].annotations (JSON, non-destructive)
```

The display canvas redraws image + annotations on every state change with devicePixelRatio scaling. Export flattening draws the original bitmap plus annotations at 1:1 scale onto a fresh canvas — opaque redaction rectangles genuinely replace the pixels beneath them (pixel-verified by E2E).

## 3. Diagnostics

```text
console text → log-scan.worker → Finding[] (line, column, masked preview)
  → review UI (redact / ignore / manual selection)
  → applyFindings(text, redacted) → sanitized text (used by preview AND exports)

.har → har-parse.worker → summary (hostnames, methods, statuses, failures)
  → review → sanitizeHar (explicit confirmation) → sanitized copy in memory
```

The raw HAR text is stored outside report state and only the sanitized copy can ever be included in an export.

## 4. Review & export

```text
report snapshot + user selections
  → buildExportPlan
      ├─ Markdown serializer (stable sections, sanitized console, HAR summary)
      ├─ JSON serializer (schemaVersion 1, metadata only, no blobs/secrets)
      ├─ PNG flattener per included evidence (variant: annotated | original)
      └─ ZIP assembler (report.md, report.json, evidence/, diagnostics/, README.txt)
  → Blobs → download (object URL, revoked) or clipboard text
```

Included items are exactly those the user marked: evidence `includedInExport` + chosen variant, console `includedInExport` (sanitized only), HAR only when a sanitized copy was prepared and included.

## 5. Persistence (opt-in only)

```text
Privacy center → "Enable local draft saving" → IndexedDB flag
Save draft → report + evidence bytes (Uint8Array) + raw HAR → IDB stores
Restore   → IDB → ReportProvider replace + blob store rebuild
Disable   → flag removed AND all drafts deleted
```

Nothing touches IndexedDB before the explicit opt-in; localStorage is never used.

## 6. What never happens

- No `fetch`/XHR to any API (enforced by E2E and a production audit).
- No report content in URLs, history state, or error messages.
- No telemetry, analytics, session replay, remote fonts or third-party runtime code.
- No silent capture: every media stream starts from an explicit user click.
