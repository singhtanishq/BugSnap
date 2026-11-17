# BugSnap export JSON schema

Versioned as `schemaVersion: 1`. The JSON export contains metadata only — never image bytes, never raw log text, never raw HAR content, never redaction match values.

## Top level

```jsonc
{
  "schemaVersion": 1,          // integer, increases on breaking changes
  "generator": "BugSnap",
  "generatedAt": "2026-11-18T09:41:00.000Z",
  "report": { ... },           // see below
  "evidence": [ ... ],         // array of evidence references
  "diagnostics": { ... }       // optional; present only if included
}
```

## `report`

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `createdAt`, `updatedAt` | string (ISO) | Identity and timestamps |
| `title` | string | Always present ("Untitled bug report" as fallback) |
| `description` | string | Verbatim user text |
| `type` | enum | `bug · visual · functional · performance · accessibility · compatibility · regression · other` |
| `severity` | enum | `critical · high · medium · low · informational` |
| `priority` | enum | `urgent · high · normal · low` |
| `status` | enum | `open · triaged · in-progress · blocked · resolved` |
| `affectedArea` | string | Free text |
| `affectedUrl` | string, optional | Present **only** when the user opted in; sanitized at input (credentials stripped, sensitive query values redacted) |
| `preconditions` | string[] | |
| `steps` | array | `{ order, action, observedResult?, isPrecondition, evidenceFiles? }` — actions are required, `evidenceFiles` lists bundle-relative PNG paths for attached evidence |
| `expectedResult`, `actualResult` | string | Required for export |
| `frequency` | enum | `always · often · sometimes · once · unable` |
| `workaround` | string, optional | Omitted when empty |
| `isRegression` | enum | `yes · no · unknown` |
| `assignee` | string | Free text, no integration |
| `labels` | string[] | |
| `environment` | object, optional | Only the fields the user opted into (see below) |

## `environment`

Keys appear only when both the field-level toggle and any secondary gate allow them:

`capturedAt · browserName · browserVersion · userAgent (also requires the explicit user-agent opt-in) · platform · viewportWidth/Height · screenWidth/Height · devicePixelRatio · language · timezone · online · colorScheme · reducedMotion · touchPoints`

## `evidence[]`

| Field | Type | Notes |
| --- | --- | --- |
| `file` | string | Bundle-relative path, e.g. `evidence/screenshot-01.png` |
| `originalName` | string | The user's filename |
| `width`, `height` | number | Natural pixel dimensions |
| `exportVariant` | enum | `annotated` (flattened) or `original` |
| `annotationCount` | number | Total annotations drawn |
| `opaqueRedactionCount` | number | Rectangles flattened as opaque blocks |
| `source` | enum | `upload · paste · drop · capture · sample` |

## `diagnostics`

```jsonc
{
  "console": {                       // only when the sanitized log is included
    "file": "diagnostics/console-sanitized.txt",
    "redactedCount": 4,
    "truncated": true                // only when the 5 MB cap truncated the input
  },
  "har": {                           // only when a sanitized HAR is included
    "file": "diagnostics/har-sanitized.har",
    "summary": {                     // hostname-level; never header/body values
      "entryCount": 6, "hostnames": ["..."], "methodCounts": {...},
      "statusCounts": {...}, "failedCount": 1, "clientErrorCount": 1,
      "serverErrorCount": 1, "totalDurationMs": 1428, "totalResponseBytes": 484074
    }
  }
}
```

## Stability contract

- `schemaVersion` increases only for breaking changes; additive fields do not bump it.
- Enum values are stable strings; new report statuses/types may be added without a version bump.
- No field in this schema contains secret material: findings (including their `matchText`) never enter the export, and the sanitized console/HAR content lives in the bundle as separate files, not inline.
