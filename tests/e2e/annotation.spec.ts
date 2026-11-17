import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodePng, pixelAt } from "./helpers/pngDecode";

/**
 * Annotation studio E2E: real canvas, real pointer input, real PNG output.
 * The redaction pixel assertions are the acceptance proof that exported
 * PNGs replace covered pixels with an opaque, uniform fill.
 */

const SAMPLE_W = 1280;
const SAMPLE_H = 800;

async function loadSample(page: Page) {
  await page.goto("#/");
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page
    .getByRole("list", { name: /Evidence images in export order/ })
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
  await page.getByRole("link", { name: "Evidence" }).first().click();
  await expect(page.getByText("aurora-settings-sample.png")).toBeVisible();
}

/**
 * The editor fits the image into its container with a 24px margin and
 * centers it; the zoom percentage display exposes the fit scale. Derive
 * the screen position of an image-space point from those facts.
 */
async function imageToScreen(
  page: Page,
  ix: number,
  iy: number,
): Promise<{ x: number; y: number; scale: number }> {
  const zoomText = await page.getByTestId("zoom-level").textContent();
  const scale = parseInt(zoomText ?? "100", 10) / 100;
  const canvas = page.getByRole("application");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas has no bounding box");
  const offsetX = (box.width - SAMPLE_W * scale) / 2;
  const offsetY = (box.height - SAMPLE_H * scale) / 2;
  return { x: box.x + offsetX + ix * scale, y: box.y + offsetY + iy * scale, scale };
}

test("annotation tools, undo and opaque redaction in exported PNG", async ({ page }) => {
  await loadSample(page);

  await page.getByRole("button", { name: /Annotate aurora-settings-sample\.png/ }).click();
  const studio = page.getByRole("dialog", { name: /Annotation studio/ });
  await expect(studio).toBeVisible();

  // The sample ships with 3 annotations (arrow, rect, marker).
  const countBadge = page.getByText(/3 annotations/);
  await expect(countBadge).toBeVisible();

  // --- Draw an arrow ---
  await page.getByRole("button", { name: /^Arrow tool/ }).click();
  const start = await imageToScreen(page, 700, 700);
  const end = await imageToScreen(page, 500, 620);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText(/4 annotations/)).toBeVisible();

  // --- Draw a rectangle outline ---
  await page.getByRole("button", { name: /^Rect tool/ }).click();
  const r1 = await imageToScreen(page, 250, 130);
  const r2 = await imageToScreen(page, 870, 380);
  await page.mouse.move(r1.x, r1.y);
  await mouseDrag(page, r2.x, r2.y);
  await expect(page.getByText(/5 annotations/)).toBeVisible();

  // --- Undo twice: back to 3, then redo restores 5 ---
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByText(/3 annotations/)).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByText(/5 annotations/)).toBeVisible();

  // --- Add a text label ---
  await page.getByRole("button", { name: /^Text tool/ }).click();
  const textPoint = await imageToScreen(page, 900, 200);
  await page.mouse.click(textPoint.x, textPoint.y);
  const textDialog = page.getByRole("dialog", { name: "Add text label" });
  await expect(textDialog).toBeVisible();
  await page.getByLabel("Text label content").fill("Misaligned toggle");
  await textDialog.getByRole("button", { name: "Add label" }).click();
  await expect(page.getByText(/6 annotations/)).toBeVisible();

  // --- Add a numbered marker ---
  await page.getByRole("button", { name: /^Marker tool/ }).click();
  const markerPoint = await imageToScreen(page, 640, 300);
  await page.mouse.click(markerPoint.x, markerPoint.y);
  await expect(page.getByText(/7 annotations/)).toBeVisible();

  // --- Add an opaque redaction over the Save button area ---
  await page.getByRole("button", { name: /^Redact tool/ }).click();
  const red1 = await imageToScreen(page, 280, 585);
  const red2 = await imageToScreen(page, 430, 655);
  await page.mouse.move(red1.x, red1.y);
  await mouseDrag(page, red2.x, red2.y);
  await expect(page.getByText(/8 annotations/)).toBeVisible();
  await expect(page.getByText(/contains redaction/)).toBeVisible();

  // --- Save PNG and verify pixels ---
  mkdirSync("test-results/annotation", { recursive: true });
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "Save PNG" }).click();
  const download = await downloadPromise;
  const outPath = path.join("test-results/annotation", download.suggestedFilename());
  await download.saveAs(outPath);

  const png = decodePng(await readFile(outPath));
  expect(png.width).toBe(SAMPLE_W);
  expect(png.height).toBe(SAMPLE_H);

  // Every pixel inside the redaction rectangle must be identical, opaque
  // red (#dc2626) — proving the fill is uniform and fully opaque.
  for (const [ix, iy] of [
    [300, 600],
    [350, 620],
    [420, 650],
    [290, 590],
    [425, 640],
  ] as Array<[number, number]>) {
    const [r, g, b, a] = pixelAt(png, ix, iy);
    expect(a, "redaction pixel alpha at " + ix + "," + iy).toBe(255);
    expect(r).toBe(220);
    expect(g).toBe(38);
    expect(b).toBe(38);
  }

  // A pixel outside the redaction must NOT be the redaction colour — the
  // surrounding image content survived (and the annotation overlay is real).
  const outside = pixelAt(png, 600, 300);
  expect(outside).not.toEqual([220, 38, 38, 255]);

  await page.getByRole("button", { name: "Close annotation studio" }).click();
  await expect(page.getByText(/8 annotations/)).toBeVisible();
});

async function mouseDrag(page: Page, x: number, y: number) {
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 6 });
  await page.mouse.up();
}
