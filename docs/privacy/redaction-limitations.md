# Redaction limitations

> "BugSnap found the items shown below. Automated detection can miss sensitive information. Review every image, URL, log and export before sharing."

This sentence appears in the product because it is true. The redaction engine is a deterministic, testable helper — not a privacy guarantee.

## What the engine does

- **Images:** opaque redaction rectangles are flattened into the exported PNG at native resolution. The E2E suite verifies the exported pixels: every sampled pixel inside a redaction rectangle is uniform and fully opaque, and surrounding content survives. The original unredacted image is excluded when the annotated variant is selected.
- **Console text:** findings marked *redacted* are replaced in the text itself (`applyFindings`), and every export path (preview, Markdown, ZIP, clipboard) consumes the same sanitized string. Hiding text with CSS is never used.
- **HAR:** sanitized copies replace `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` and API-key-like header values, redact cookie arrays and sensitive query parameter values, and omit request/response bodies entirely. Raw HAR files are never attached.

## What it cannot promise

- **False negatives.** Secrets in unusual formats, binary data, non-English PII, obfuscated values or anything not matching the built-in or user-defined patterns will pass through undetected.
- **False positives.** Phone-like digit groups and generic assignments are labelled low/medium confidence for a reason.
- **Detector reach.** The 14 built-in categories cover common formats (emails, IPs, Luhn-valid cards, JWTs, bearer tokens, private keys, AWS/GitHub/Slack credentials, key assignments, Set-Cookie, sensitive query parameters). They are not a complete inventory of what your organisation considers secret.
- **Redaction is not deletion.** A redacted export still proves the data existed (line numbers shift, placeholder values are visible).
- **Human error dominates.** Most accidental disclosures come from things automation was never asked to look at: names in URLs, internal hostnames, tokens in screenshots of terminals.

## Rules for using it safely

1. Treat findings as a checklist, not a verdict — read the full text.
2. Use manual selection redaction for anything the scan missed.
3. Open the sanitized preview and the sanitized HAR copy before exporting.
4. Prefer the annotated/redacted export variant over original pixels.
5. Remember that a blurred or semi-transparent redaction is not redaction — BugSnap uses opaque fills deliberately.
6. Custom regex rules are validated for length and backtracking, but a bad rule can still over-match. Test rules on synthetic data first.

## Verification

- `tests/unit/redactionPatterns.test.ts` — detector coverage, false positives, masking.
- `tests/unit/applyFindings.test.ts` — replacements land in the export text.
- `tests/unit/har.test.ts` — sanitized copy removes known secrets and preserves structure.
- `tests/e2e/annotation.spec.ts` — pixel-level proof of opaque redaction in exported PNGs.
- `tests/e2e/export.spec.ts` — exports contain sanitized content and exclude raw secrets.
