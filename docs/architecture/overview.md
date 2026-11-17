# Architecture overview

BugSnap is a static client-side application: a Vite build of React + TypeScript that runs entirely in the browser tab. There is no backend, no API and no third-party runtime code.

## Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Build | Vite 7 | Fast dev server, static output, Web Worker support |
| UI | React 19 + TypeScript (strict) | Typed, componentised, widely understood |
| Styling | Tailwind CSS 4 | Design tokens via `@theme`, no remote fonts |
| Routing | Custom hash router (`src/app/router.tsx`) | Works on GitHub Pages project subpaths without rewrite rules |
| State | React reducer in `ReportProvider` | Single source of truth; evidence blobs stay out of React state |
| Canvas | Native Canvas 2D | Full control over annotation flattening and export pixels |
| ZIP | JSZip | Mature, bundled locally |
| Drafts | `idb` over IndexedDB | Opt-in persistence with a small, auditable wrapper |
| Validation | Hand-written typed validators + Zod-shaped model types | Deterministic, testable, no form-library complexity |
| Tests | Vitest + Testing Library, Playwright, axe-core | Unit, integration, real-browser E2E, WCAG audits |

## Module layout

```text
src/
├── app/            App shell, hash router, report store (ReportProvider)
├── components/     ui/ design system, layout/ shell, feedback/ toasts + error boundary
├── features/       one folder per product area (overview, report-builder, …)
├── lib/
│   ├── annotation/ geometry, history, render, flatten — pure, testable
│   ├── redaction/  patterns (detectors, Luhn) and apply (export path)
│   ├── har/        parse (summary), sanitize (confirmed copies)
│   ├── export/     markdown, json, templates, bundle (ZIP), filenames
│   ├── validation/ URL sanitizer, export readiness
│   ├── browser/    environment detection, screen capture
│   ├── files/      size limits, evidence blob store, raw-HAR store, readers
│   ├── storage/    IndexedDB draft persistence (opt-in)
│   └── demo/       synthetic sample data (clearly fictional)
├── workers/        log-scan.worker.ts, har-parse.worker.ts
├── types/          report, annotation, diagnostics, redaction models
└── styles/         Tailwind theme tokens
```

## Key design decisions

1. **Non-destructive annotations.** Annotations are JSON objects in natural image pixel space. Source pixels are never modified in memory; the export flattener draws image + annotations onto a fresh canvas at native resolution.
2. **Blobs live outside React state.** `evidenceStore` maps evidence ids to `{blob, url}` with deterministic revocation. React state carries metadata only, avoiding duplicate multi-megabyte copies.
3. **The raw HAR never enters report state.** It lives in a module-level memory store keyed by import id so it can be sanitized on request but cannot leak into exports or drafts.
4. **Exports are pure serializers.** `buildExportPlan` validates and assembles every artifact from the current report snapshot; the UI only triggers downloads and clipboard writes.
5. **Sanitization applies to the export data itself.** `applyFindings` produces the sanitized text that Markdown/ZIP/preview all consume — hiding text in CSS is never used.
6. **Workers for heavy parsing.** Log scanning and HAR parsing run in Web Workers with request ids for stale-result handling and synchronous fallbacks where workers are unavailable.
7. **Hash routing.** GitHub Pages serves `/BugSnap/` without rewrites; hash routes keep deep links and refreshes working.
8. **Everything is size-capped and validated.** Image 20 MB / 50 MP, text 5 MB, HAR 20 MB / 50,000 entries — defined in one place (`lib/files/fileValidation.ts`) and surfaced in the UI.
