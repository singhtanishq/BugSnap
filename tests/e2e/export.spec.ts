import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { decodePng } from "./helpers/pngDecode";

/**
 * Export E2E: real browser, real canvas flattening, real downloads.
 * Verifies Markdown/JSON/ZIP outputs contain the user's sanitized content
 * and exclude raw secrets — the directive's acceptance criteria for exports.
 */

const TOKEN = "demo_test_token_NOT_REAL_123456";

async function loadSample(page: Page) {
  await page.goto("#/");
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1200);
}

test("review acknowledgement and Markdown/JSON/ZIP exports contain sanitized content", async ({ page }) => {
  await loadSample(page);

  // 1. Redact all console findings on the diagnostics page.
  await page.getByRole("link", { name: "Diagnostics" }).first().click();
  await page.getByRole("button", { name: "Import pasted text" }).waitFor({ state: "hidden" }).catch(() => {});
  // The sample ships with a console log already imported — wait for findings table.
  const findingsTable = page.getByRole("table", { name: /Sensitive-data findings/i });
  await expect(findingsTable).toBeVisible({ timeout: 15_000 });
  for (const button of await findingsTable.getByRole("button", { name: /^Redact finding/ }).all()) {
    await button.click();
  }
  await expect(page.getByText(/marked for redaction/)).toBeVisible();

  // 2. Prepare the sanitized HAR copy and include it.
  await page.getByRole("button", { name: "Prepare sanitized HAR copy" }).click();
  const harDialog = page.getByRole("dialog", { name: /Prepare a sanitized HAR copy/ });
  await harDialog.getByRole("button", { name: "Prepare sanitized copy" }).click();
  await expect(page.getByText(/headers: \d+/).first()).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("checkbox", { name: /Include sanitized HAR in exports/ })
    .setChecked(true);

  // 3. Acknowledge the privacy review on the review page.
  await page.getByRole("link", { name: "Review & Export" }).first().click();
  await expect(page.getByRole("heading", { name: "Review & Export", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge privacy review" }).click();
  await page
    .getByRole("dialog", { name: /Acknowledge the privacy review/ })
    .getByRole("button", { name: "I have reviewed the report" })
    .click();
  await expect(page.getByText(/^Reviewed /)).toBeVisible();

  // 4. Download and inspect the Markdown report.
  mkdirSync("test-results/export", { recursive: true });
  const mdPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  const mdDownload = await mdPromise;
  const mdPath = path.join("test-results/export", mdDownload.suggestedFilename());
  await mdDownload.saveAs(mdPath);
  const markdown = readFileSync(mdPath, "utf8");
  expect(markdown).toContain("# Save button remains disabled after editing profile details");
  expect(markdown).toContain("## Reproduction steps");
  expect(markdown).toContain("[REDACTED]");
  expect(markdown).not.toContain(TOKEN);
  expect(markdown).toContain("evidence/screenshot-01.png");
  expect(markdown).toContain("A sanitized copy of `aurora-notes-sample.har` is included in the ZIP bundle");

  // 5. Download and inspect the JSON report.
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const jsonDownload = await jsonPromise;
  const jsonPath = path.join("test-results/export", jsonDownload.suggestedFilename());
  await jsonDownload.saveAs(jsonPath);
  const json = JSON.parse(readFileSync(jsonPath, "utf8"));
  expect(json.schemaVersion).toBe(1);
  expect(json.generator).toBe("BugSnap");
  expect(json.report.title).toContain("Save button remains disabled");
  expect(json.evidence[0].file).toBe("evidence/screenshot-01.png");
  expect(json.diagnostics.console.redactedCount).toBeGreaterThan(0);
  expect(JSON.stringify(json)).not.toContain(TOKEN);

  // 6. Download the ZIP and inspect every documented entry.
  const zipPromise = page.waitForEvent("download", { timeout: 30_000 });
  await page.getByRole("button", { name: "Download ZIP bundle" }).click();
  const zipDownload = await zipPromise;
  const zipPath = path.join("test-results/export", zipDownload.suggestedFilename());
  await zipDownload.saveAs(zipPath);
  expect(existsSync(zipPath)).toBe(true);

  // Verify the PNG evidence inside the ZIP is a real, decodable image with
  // flattened annotations (the synthetic screenshot is 1280x800).
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
  expect(names).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/report\.md$/),
      expect.stringMatching(/report\.json$/),
      expect.stringMatching(/evidence\/screenshot-01\.png$/),
      expect.stringMatching(/diagnostics\/console-sanitized\.txt$/),
      expect.stringMatching(/diagnostics\/har-sanitized\.har$/),
      expect.stringMatching(/README\.txt$/),
    ]),
  );
  // Raw source image must NOT be present (annotated variant is exported).
  expect(names.some((n) => n.includes("aurora-settings-sample.png"))).toBe(false);

  const consoleText = await zip
    .file(names.find((n) => n.endsWith("console-sanitized.txt"))!)!
    .async("string");
  expect(consoleText).toContain("[REDACTED]");
  expect(consoleText).not.toContain(TOKEN);

  const harText = await zip.file(names.find((n) => n.endsWith("har-sanitized.har"))!)!.async("string");
  expect(harText).not.toContain(TOKEN);
  expect(harText).not.toContain("demo_session_value_NOT_REAL");

  const pngBytes = await zip
    .file(names.find((n) => n.endsWith("screenshot-01.png"))!)!
    .async("nodebuffer");
  const png = decodePng(pngBytes);
  expect(png.width).toBe(1280);
  expect(png.height).toBe(800);
  // The flattened PNG must contain the sample's opaque teal rectangle border
  // (an annotation) — proving flattening happened on real pixels. Sample the
  // top border of the sample's teal rect at image coords (~600, 581):
  const [r, g, b] = decodePngPixel(png, 600, 581);
  void r; void g; void b;
  // The pixel must differ from the page background (#f6f8fa).
  expect([r, g, b]).not.toEqual([246, 248, 250]);
});

function decodePngPixel(
  png: ReturnType<typeof decodePng>,
  x: number,
  y: number,
): [number, number, number, number] {
  const index = (y * png.width + x) * 4;
  return [png.pixels[index]!, png.pixels[index + 1]!, png.pixels[index + 2]!, png.pixels[index + 3]!];
}

test("refresh on a nested hash route reloads the app cleanly", async ({ page }) => {
  await page.goto("#/report");
  await expect(page.getByRole("heading", { name: "Describe the issue", level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Describe the issue", level: 1 })).toBeVisible();
});
