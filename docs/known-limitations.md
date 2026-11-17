# Known limitations

Honest, current as of this release.

## Screen capture

- Requires a **secure context** (HTTPS or localhost) and browser support. Where unavailable, BugSnap says so and offers upload/paste alternatives.
- The browser's chooser decides what can be shared; BugSnap cannot and does not bypass it.
- The final "approve the chooser → frame appears" step cannot be automated by the test suite; it is verified manually up to the chooser (see `docs/testing/browser-compatibility.md`).

## Detection and redaction

- Automated detection is heuristic. It will miss secrets in unusual formats and can mislabel benign values. Manual review of every export is required — this is a product principle, not boilerplate.
- Phone detection is intentionally low-confidence because formats vary by region.
- Credit-card detection reports only Luhn-valid numbers, so invalid test numbers pass silently by design.

## Environment detection

- Browsers do not expose the exact OS or always-accurate versions. Values are labelled "detected" or "browser-reported" and remain optional.

## Storage

- Local drafts (opt-in) are **unencrypted** IndexedDB records. Browser "clear site data" removes them; a different browser or profile cannot see them.
- Storage usage estimates are browser-reported approximations and hidden where unsupported.

## Platform limits

- Image evidence: 20 MB and 50 MP guards — larger images are rejected with an explanation rather than silently downscaled.
- Console text: 5 MB cap with explicit truncation warnings (nothing is dropped silently).
- HAR: 20 MB and 50,000 entries; oversized inputs are rejected or truncated with visible warnings.

## Scope

- No live Jira/Linear/GitHub integration — the templates are clipboard text on purpose. OAuth and API tokens are out of scope for a local-only tool.
- No browser extension or desktop companion; a normal website cannot read another tab's DevTools console, so console text must be pasted in.
- Firefox and WebKit were not exercised in this release's automated matrix; Chromium is the tested reference (see `docs/testing/browser-compatibility.md`).
