#!/usr/bin/env node
/**
 * Generates the Open Graph social preview image (1200x630) from a branded
 * HTML card rendered by a real browser. One-off, re-runnable:
 *   node scripts/generate-og-image.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const html = `<!doctype html>
<html><head><style>
  body { margin: 0; }
  .card {
    width: 1200px; height: 630px;
    background: linear-gradient(135deg, #f6f8fa 0%, #ecfdf9 100%);
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 80px; box-sizing: border-box;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative; overflow: hidden;
  }
  .glow {
    position: absolute; right: -140px; top: -140px; width: 480px; height: 480px;
    border-radius: 50%; background: radial-gradient(circle, #14b8a6 0%, rgba(20,184,166,0) 70%);
    opacity: 0.25;
  }
  .brand { display: flex; align-items: center; gap: 20px; }
  .logo { width: 84px; height: 84px; }
  .wordmark { font-size: 44px; font-weight: 700; color: #101a2e; letter-spacing: -0.02em; }
  .wordmark span { color: #0f766e; }
  h1 { font-size: 58px; line-height: 1.12; color: #101a2e; margin: 36px 0 0; letter-spacing: -0.02em; max-width: 900px; }
  p { font-size: 26px; color: #42536f; margin: 26px 0 0; max-width: 820px; line-height: 1.45; }
  .badges { display: flex; gap: 14px; margin-top: 34px; }
  .badge {
    font-size: 20px; font-weight: 600; color: #0f766e;
    background: #ffffff; border: 2px solid #99f6e4; border-radius: 999px;
    padding: 10px 22px;
  }
</style></head>
<body>
  <div class="card">
    <div class="glow"></div>
    <div class="brand">
      <svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bg)"/>
        <rect x="14" y="18" width="36" height="26" rx="5" fill="#ffffff" opacity="0.92"/>
        <circle cx="32" cy="31" r="8" fill="none" stroke="#0f766e" stroke-width="3.5"/>
        <circle cx="32" cy="31" r="3" fill="#0f766e"/>
        <rect x="24" y="12" width="16" height="7" rx="3" fill="#ffffff" opacity="0.92"/>
        <rect x="44" y="24" width="7" height="4" rx="2" fill="#ffffff" opacity="0.92"/>
      </svg>
      <div class="wordmark">Bug<span>Snap</span></div>
    </div>
    <h1>Capture it. Explain it.<br/>Ship the fix.</h1>
    <p>Private, local-first visual bug reports — annotated screenshots, reproducible steps and sanitized diagnostics, built entirely in your browser.</p>
    <div class="badges">
      <div class="badge">No uploads</div>
      <div class="badge">No backend</div>
      <div class="badge">Export MD · JSON · PNG · ZIP</div>
    </div>
  </div>
</body></html>`;

mkdirSync("public/og", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.locator(".card").screenshot({ path: "public/og/bugsnap-og.png" });
await browser.close();
console.log("og image written to public/og/bugsnap-og.png");
