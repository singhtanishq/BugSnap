#!/usr/bin/env node
/**
 * Production network audit.
 *
 * Serves the production build (vite preview), walks the complete workflow in
 * a real browser, and fails if ANY request leaves the app origin. Run with:
 *   pnpm build && node scripts/audit-runtime-network.mjs
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4174;
const BASE = `http://localhost:${PORT}`;

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  return false;
}

const preview = spawn("node", ["node_modules/vite/bin/vite.js", "preview", "--port", String(PORT), "--strictPort"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});

try {
    preview.stderr?.on("data", (data) => console.error("[preview]", String(data).trim()));
  const up = await waitForServer(`${BASE}/BugSnap/`);
  if (!up) {
    console.error("FAIL: preview server did not start (run `pnpm build` first).");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [];

  page.on("request", (request) => {
    requests.push(request.url());
  });

  await page.goto(`${BASE}/BugSnap/#/`);
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("link", { name: "Evidence" }).first().click();
  await page.getByRole("button", { name: /Annotate aurora-settings-sample/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Close annotation studio" }).click();
  await page.getByRole("link", { name: "Diagnostics" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("link", { name: "Review & Export" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Download Markdown" }).click().catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("link", { name: "Help" }).first().click();
  await page.waitForTimeout(300);

  const appOrigin = new URL(page.url()).origin;
  const external = requests.filter(
    (url) => url.startsWith("http") && !url.startsWith(appOrigin),
  );

  await browser.close();

  if (external.length > 0) {
    console.error(`FAIL: ${external.length} external request(s) detected:`);
    for (const url of external) console.error(`  ${url}`);
    process.exitCode = 1;
  } else {
    console.log(
      `PASS: ${requests.length} request(s), all same-origin (${appOrigin}). No external calls, no uploads, no analytics.`,
    );
  }
} finally {
  try {
    process.kill(-preview.pid, "SIGTERM");
  } catch {
    // already gone
  }
}
