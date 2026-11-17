#!/usr/bin/env node
/**
 * Genuine screenshot capture for the root README.
 *
 * Drives the real running BugSnap app through its workflows with synthetic
 * data only, saving PNGs into docs/screenshots/. Run with the dev server up:
 *   pnpm dev & node scripts/capture-screenshots.mjs
 * (The script starts its own preview server if nothing is running.)
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const PORT = process.env.BUGSNAP_CAPTURE_PORT ? Number(process.env.BUGSNAP_CAPTURE_PORT) : 5199;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/screenshots";

let previewProcess = null;

async function ensureServer() {
  try {
    const response = await fetch(`${BASE}/BugSnap/`);
    if (response.ok) return;
  } catch {
    // not running
  }
  previewProcess = spawn(
    "node",
    ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"],
    { cwd: process.cwd(), stdio: "ignore", detached: true },
  );
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${BASE}/BugSnap/`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  console.error("No BugSnap server available; start `pnpm dev` or run `pnpm build` first.");
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

mkdirSync(OUT, { recursive: true });

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(`captured ${name}`);
};

async function loadSample() {
  await page.goto(`${BASE}/BugSnap/#/`);
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1500);
}

await ensureServer();

/* 01 — Overview, pristine first-run state */
await page.goto(`${BASE}/BugSnap/#/`);
await page.waitForTimeout(600);
await shot("01-homepage.png");

await loadSample();

/* 02 — Report builder */
await page.getByRole("link", { name: "New Report" }).first().click();
await page.waitForTimeout(400);
await shot("02-report-builder.png");

/* 03 — Reproduction steps */
await page.getByRole("link", { name: "Steps", exact: true }).first().click();
await page.waitForTimeout(400);
await shot("03-reproduction-steps.png");

/* 04 — Evidence workspace */
await page.getByRole("link", { name: "Evidence" }).first().click();
await page.waitForTimeout(500);
await shot("04-evidence-workspace.png");

/* 05 — Annotation studio */
await page.getByRole("button", { name: /Annotate aurora-settings-sample/ }).click();
await page.waitForTimeout(800);
await shot("05-annotation-studio.png");
await page.getByRole("button", { name: "Done — close annotation studio" }).click();
await page.waitForTimeout(300);

/* 06 — Diagnostics console with findings */
await page.getByRole("link", { name: "Diagnostics" }).first().click();
await page.waitForTimeout(600);
await shot("06-diagnostics-console.png");

/* 07 — HAR review with sanitized copy prepared */
const prepareButton = page.getByRole("button", { name: "Prepare sanitized HAR copy" });
if (await prepareButton.isVisible().catch(() => false)) {
  await prepareButton.click();
  await page
    .getByRole("dialog", { name: /Prepare a sanitized HAR copy/ })
    .getByRole("button", { name: "Prepare sanitized copy" })
    .click();
  await page.getByText(/headers: \d+/).first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}
await shot("07-har-review.png");

/* 08 — Redaction review: mark findings redacted and show sanitized preview */
const findingsTable = page.getByRole("table", { name: /Sensitive-data findings/i });
if (await findingsTable.isVisible().catch(() => false)) {
  for (const button of await findingsTable
    .getByRole("button", { name: /^Redact finding/ })
    .all()) {
    await button.click();
  }
}
await page.getByRole("button", { name: "Sanitized preview" }).click();
await page.waitForTimeout(300);
await shot("08-redaction-review.png");

/* 09 — Report preview */
await page.getByRole("link", { name: "Review & Export" }).first().click();
await page.waitForTimeout(600);
await shot("09-report-preview.png");

/* 10 — Export options (scroll to the export card) */
await page.getByRole("button", { name: "Download ZIP bundle" }).scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await shot("10-export-options.png");

/* 11 — Privacy center */
await page.getByRole("link", { name: "Privacy" }).first().click();
await page.waitForTimeout(500);
await shot("11-privacy-center.png");

/* 12 — Mobile layout */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/BugSnap/#/`);
await page.waitForTimeout(600);
await shot("12-mobile-layout.png");

await browser.close();
if (previewProcess) {
  try {
    process.kill(-previewProcess.pid, "SIGTERM");
  } catch {
    // already gone
  }
}
console.log("done");
