# BugSnap privacy model

## The short version

BugSnap is a static web application. Your report, screenshots, logs and HAR data are processed in your browser tab. BugSnap has no backend and no API. Nothing about your report is transmitted to BugSnap — because there is no BugSnap to transmit to.

## Precise statements

- **No uploads.** The production runtime makes no external requests for report contents, images, logs, HAR data or telemetry. A Playwright test and a production-build audit (`scripts/audit-runtime-network.mjs`) fail the build if any request leaves the app origin.
- **Screen capture is user-initiated.** Capture starts only after you click a labelled control and approve the browser's own screen/window/tab chooser. BugSnap reads a single still frame, then stops every media track — on success, on error and on cancellation. Captured frames are never uploaded.
- **In-memory by default.** The report, evidence bytes, console text, findings and the raw HAR live in tab memory and vanish when the tab closes unless you export them or enable drafts.
- **IndexedDB is opt-in.** Drafts are written only after you enable local draft saving in the Privacy center. Disabling deletes all stored drafts. localStorage is never used.
- **Drafts are not encrypted.** IndexedDB is browser storage, not a secure vault. Anyone with access to your browser profile can read drafts. Use the feature only on devices you trust.
- **Exports are explicit.** Files are written only when you click an export action; the bytes are generated locally and handed to your browser's download mechanism.
- **Clipboard actions are yours.** Copy Markdown/templates places text on your clipboard under your control.

## Hosting caveat

The app is served by GitHub Pages. Like every web host, the provider processes ordinary request logs — your IP address, requested URLs, timestamps and user agent as sent by your browser. BugSnap cannot see, avoid or change that, and it is independent of BugSnap's own code. What the host never receives is your report content: page loads carry only normal HTTP requests for static assets.

## What can still disclose information

- Sharing an exported file that contains unreviewed content.
- Pasting a report into a tracker, chat or email yourself.
- Screenshots you choose to capture with the OS or with BugSnap's explicit capture flow.
- A draft left on a shared or compromised device.

Automated redaction reduces risk; it does not remove the need for human review.

## What BugSnap never collects

- Geolocation or precise location.
- Device identifiers, serial numbers or account identifiers.
- Browsing history or other tabs' content.
- Telemetry, analytics, session replay or error monitoring.
